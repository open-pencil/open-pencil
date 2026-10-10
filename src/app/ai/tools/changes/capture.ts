import { diffLines, type ChangeObject } from 'diff'
import { compact, uniq } from 'es-toolkit/array'

import {
  graphFromDocumentChange,
  isEmptyDocumentChange,
  type DocumentChange
} from '@open-pencil/core/editor'
import { diffPageLayersJSX } from '@open-pencil/core/tools'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { changePreviewSize } from '@/app/ai/chat/preferences'
import type { EditorStore } from '@/app/editor/active-store'

import { renderToolChangeImages } from './images'
import { setToolChange } from './store'
import type { ToolChange } from './types'

/** Longer sources keep only the changed region, so the history stays small. */
const MAX_JSX_LENGTH = 40_000
/** Unchanged source kept on each side of the changed region. */
const CLIP_CONTEXT = 2_000

function joinJSX(sources: string[]): string {
  return compact(sources).join('\n\n')
}

function lineStart(text: string, index: number): number {
  return index <= 0 ? 0 : text.lastIndexOf('\n', index - 1) + 1
}

/**
 * Clips both sources to the region where they differ, plus context, so a change deep in a
 * long layer stays visible. Clipping each source from the start would cut it off.
 */
export function clipChangedJSX(before: string, after: string): [string, string] {
  if (before.length <= MAX_JSX_LENGTH && after.length <= MAX_JSX_LENGTH) return [before, after]
  // The unchanged lines before the first change and after the last one.
  const changes = diffLines(before, after)
  const unchanged = (change: ChangeObject<string> | undefined) =>
    change && !change.added && !change.removed ? change.value.length : 0
  const prefix = unchanged(changes[0])
  const suffix = changes.length > 1 ? unchanged(changes.at(-1)) : 0
  const clip = (text: string): string => {
    const from = lineStart(text, prefix - CLIP_CONTEXT)
    const to = Math.min(text.length, text.length - suffix + CLIP_CONTEXT)
    let region = text.slice(from, to)
    if (region.length > MAX_JSX_LENGTH) region = `${region.slice(0, MAX_JSX_LENGTH)}\n…`
    return `${from > 0 ? '…\n' : ''}${region}${to < text.length ? '\n…' : ''}`
  }
  return [clip(before), clip(after)]
}

/** The first page, the call's own one first, whose layers the change added, removed, or changed. */
function changedPage(before: SceneGraph, after: SceneGraph, change: DocumentChange) {
  for (const pageId of uniq([change.pageId, ...change.pageIds])) {
    const layers = diffPageLayersJSX(before, after, pageId)
    if (layers.length > 0) return { pageId, layers }
  }
  return null
}

/**
 * Records what a finished call changed, called right after it while the document is as the call
 * left it. The review shows one page: the one the call ran on when its layers changed, otherwise
 * the first other page whose layers did. The structural diff is immediate; images render
 * afterwards from frozen copies of both states, so later edits cannot leak into them.
 */
export function recordToolChange(
  store: EditorStore,
  toolCallId: string,
  documentChange: DocumentChange
): ToolChange | null {
  if (isEmptyDocumentChange(documentChange)) return null
  const beforeGraph = graphFromDocumentChange(store.graph, documentChange, 'before')
  const afterGraph = graphFromDocumentChange(store.graph, documentChange, 'after')
  if (!beforeGraph || !afterGraph) return null
  // The same JSX diff `diff_jsx` returns decides which layers changed.
  const shown = changedPage(beforeGraph, afterGraph, documentChange)
  if (!shown) return null
  const { pageId, layers } = shown
  const nodeIds = layers.map((layer) => layer.id)
  const [jsxBefore, jsxAfter] = clipChangedJSX(
    joinJSX(layers.map((layer) => layer.before)),
    joinJSX(layers.map((layer) => layer.after))
  )
  const change: ToolChange = {
    toolCallId,
    pageId,
    nodeIds,
    jsx: { before: jsxBefore, after: jsxAfter }
  }
  setToolChange(change)
  const size = changePreviewSize.value
  if (size !== 'off') {
    void (async () => {
      const images = await renderToolChangeImages(store, {
        beforeGraph,
        afterGraph,
        pageId,
        nodeIds,
        size
      })
      if (images) setToolChange({ ...change, images })
    })().catch((error: unknown) => console.warn('Could not render AI change previews', error))
  }
  return change
}
