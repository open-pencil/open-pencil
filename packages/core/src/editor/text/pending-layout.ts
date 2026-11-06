import { compact } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { generatedFrameOwner } from '@open-pencil/scene-graph/generated'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { EditorContext } from '#core/editor/types'
import { sizeAutoResizingText } from '#core/layout/text-auto-resize'
import { fontManager } from '#core/text/font/manager'
import { collectNodeFontFaces } from '#core/text/requirements/collect'

export type PendingLayoutRenderer = Pick<
  SkiaRenderer,
  'measureTextNode' | 'nodeFontReadiness' | 'fontsLoaded' | 'whenFontsLoaded' | 'syncFontGeneration'
>

interface PendingTextLayoutContext {
  getGraph: () => SceneGraph
  getRenderer: () => PendingLayoutRenderer | null
  /** Prepares the fonts of `texts`: `prepareTextFonts` with the editor's loader. */
  prepareFonts: (texts: SceneNode[]) => Promise<unknown>
  runLayoutForNode: (id: string) => void
  requestRender: () => void
  onEditorEvent: EditorContext['onEditorEvent']
}

/**
 * Text that layout reaches before its fonts are prepared keeps the size it has and stays off the
 * canvas while `prepareFonts` prepares them. Then it is measured, the frames around it are laid
 * out, and it draws, once, in its own fonts. Edits apply at once and never wait for fonts, so
 * nothing lands late over a newer edit, an undo, or another document. Laying text out again adds
 * no undo step, and layout of the document's own state stays derived.
 */
export function createPendingTextLayout(ctx: PendingTextLayoutContext) {
  /** Layer id → whether it was measured only while laying out the document's own state. */
  const queued = new Map<string, boolean>()
  /** Text its fonts could not measure, prepared or failed, tried again once fonts settle. */
  const stalled = new Map<string, boolean>()
  /** Text measured in the substitute for a face found nowhere, laid out again when its family loads. */
  const substituted = new Map<string, boolean>()
  /** The text being laid out after its fonts were prepared, which measuring does not queue again. */
  let layingOut: ReadonlySet<string> = new Set()
  /** Queued text kept off the canvas, each holding one block its preparation releases. */
  const hidden = new Set<string>()
  let scheduled = false
  /** Counts replaced documents, whose text a preparation still running no longer lays out. */
  let documents = 0

  function measure(renderer: PendingLayoutRenderer, node: SceneNode, maxWidth?: number) {
    const size = renderer.measureTextNode(node, maxWidth)
    if (!size && node.type === 'TEXT' && node.text) defer(node.id)
    else if (size && renderer.nodeFontReadiness(node) === 'substituted') {
      note(substituted, node.id, ctx.getGraph().isApplyingDerivedLayout)
    } else if (size) substituted.delete(node.id)
    return size
  }

  function note(into: Map<string, boolean>, id: string, derived: boolean) {
    into.set(id, (into.get(id) ?? true) && derived)
  }

  function defer(id: string) {
    const derived = ctx.getGraph().isApplyingDerivedLayout
    if (layingOut.has(id)) {
      note(stalled, id, derived)
      return
    }
    if (!hidden.has(id)) {
      fontManager.blockNodesUntilFontsResolve(ctx.getGraph(), [id])
      hidden.add(id)
    }
    note(queued, id, derived)
    schedule()
  }

  function schedule() {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => void prepareQueued())
  }

  async function prepareQueued() {
    scheduled = false
    if (queued.size === 0) return
    const batch = new Map(queued)
    queued.clear()
    const graph = ctx.getGraph()
    const opened = documents
    const ids = [...batch.keys()]
    const held = ids.filter((id) => hidden.delete(id))
    try {
      const renderer = ctx.getRenderer()
      if (renderer && !renderer.fontsLoaded) await renderer.whenFontsLoaded()
      await ctx.prepareFonts(compact(ids.map((id) => graph.getNode(id))))
    } catch (error) {
      // Text in faces that did load is still laid out; text in faces that failed stalls there.
      console.warn('Text fonts could not be prepared:', error)
    } finally {
      // Text queued again meanwhile holds a block of its own until it is prepared in turn.
      fontManager.unblockNodes(graph, held)
    }
    if (opened !== documents || ctx.getGraph() !== graph) return
    layOut(graph, batch)
  }

  function layOut(graph: SceneGraph, batch: ReadonlyMap<string, boolean>) {
    ctx.getRenderer()?.syncFontGeneration()
    const edited: string[] = []
    const derived: string[] = []
    for (const [id, isDerived] of batch) {
      if (graph.getNode(id)) (isDerived ? derived : edited).push(id)
    }
    // Layout measures text only in auto layout; text that sizes itself is measured here,
    // unless it keeps the glyphs its file saved, whose size is the file's.
    const relayout = (id: string) => {
      const node = graph.getNode(id)
      if (!node) return
      if (!node.derivedTextGlyphs?.length) sizeAutoResizingText(graph, id)
      ctx.runLayoutForNode(id)
      // A sticky note, shape, or connector fits itself to the text it is named by.
      const owner = generatedFrameOwner(graph, node)
      if (owner) ctx.runLayoutForNode(owner.id)
    }
    layingOut = new Set(batch.keys())
    try {
      if (derived.length > 0) graph.applyDerivedLayoutDuring(() => derived.forEach(relayout))
      edited.forEach(relayout)
    } finally {
      layingOut = new Set()
    }
    ctx.requestRender()
  }

  /** Tries the text again that its prepared fonts could not measure, once fonts have settled. */
  function retryStalled() {
    if (stalled.size === 0) return
    // It shows already, in the faces it has, and keeps showing while it is tried again.
    for (const [id, derived] of stalled) note(queued, id, derived)
    stalled.clear()
    schedule()
  }

  /** Lays the text measured in a substitute out again whose runs name `family`, which loaded. */
  function retrySubstituted(family: string) {
    const graph = ctx.getGraph()
    for (const [id, derived] of substituted) {
      const node = graph.getNode(id)
      if (!node || !collectNodeFontFaces(node).some((face) => face.family === family)) continue
      substituted.delete(id)
      note(queued, id, derived)
    }
    if (queued.size > 0) schedule()
  }

  /** Drops the text of the document about to be replaced, before the editor replaces it. */
  function clear() {
    fontManager.unblockNodes(ctx.getGraph(), [...hidden])
    hidden.clear()
    queued.clear()
    stalled.clear()
    substituted.clear()
    documents++
  }

  ctx.onEditorEvent('font:resolution-changed', (event) => {
    if (event === 'settled') retryStalled()
  })
  ctx.onEditorEvent('font:loaded', (family) => {
    // A face loaded outside the resolver can be the one stalled text was missing.
    retryStalled()
    retrySubstituted(family)
  })
  ctx.onEditorEvent('node:deleted', (id) => {
    stalled.delete(id)
    substituted.delete(id)
  })

  return { measure, retryStalled, clear }
}
