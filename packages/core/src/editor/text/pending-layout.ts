import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { isNodeFontLoaded } from '#core/canvas/text'
import { sizeAutoResizingText } from '#core/layout/text-auto-resize'

export type PendingLayoutRenderer = Pick<SkiaRenderer, 'measureTextNode' | 'fontsLoaded'> &
  Parameters<typeof isNodeFontLoaded>[0]

interface PendingTextLayoutContext {
  getGraph: () => SceneGraph
  runLayoutForNode: (id: string) => void
  requestRender: () => void
  /** Whether the renderer can measure this layer with its own faces. */
  isReady?: (renderer: PendingLayoutRenderer, node: SceneNode) => boolean
}

function facesLoaded(renderer: PendingLayoutRenderer, node: SceneNode): boolean {
  return renderer.fontsLoaded && isNodeFontLoaded(renderer, node)
}

/**
 * Text measured before its face loaded is laid out with an estimate. Remember those layers and,
 * once their faces settle, measure them again and lay out the frames around them, so auto-sized
 * text takes its real size wherever it sits, without adding an undo step. Layout of the
 * document's own state stays derived.
 */
export function createPendingTextLayout(ctx: PendingTextLayoutContext) {
  /** Layer id → whether it was measured while laying out the document's own state. */
  const pending = new Map<string, boolean>()
  const ready = ctx.isReady ?? facesLoaded

  function measure(renderer: PendingLayoutRenderer, node: SceneNode, maxWidth?: number) {
    const size = renderer.measureTextNode(node, maxWidth)
    if (!size && node.type === 'TEXT' && node.text && !ready(renderer, node)) {
      const graph = ctx.getGraph()
      pending.set(node.id, (pending.get(node.id) ?? true) && graph.isApplyingDerivedLayout)
    }
    return size
  }

  function relayoutReady(renderer: PendingLayoutRenderer | null) {
    if (!renderer || pending.size === 0) return
    const graph = ctx.getGraph()
    const edited: string[] = []
    const derived: string[] = []
    for (const [id, isDerived] of pending) {
      const node = graph.getNode(id)
      if (node && !ready(renderer, node)) continue
      pending.delete(id)
      if (node) (isDerived ? derived : edited).push(id)
    }
    if (edited.length === 0 && derived.length === 0) return
    // Layout measures text only in auto layout; text that sizes itself is measured here,
    // unless it keeps the glyphs its file saved, whose size is the file's.
    const relayout = (id: string) => {
      if (!graph.getNode(id)?.derivedTextGlyphs?.length) sizeAutoResizingText(graph, id)
      ctx.runLayoutForNode(id)
    }
    if (derived.length > 0) graph.applyDerivedLayoutDuring(() => derived.forEach(relayout))
    edited.forEach(relayout)
    ctx.requestRender()
  }

  return { measure, relayoutReady, clear: () => pending.clear() }
}
