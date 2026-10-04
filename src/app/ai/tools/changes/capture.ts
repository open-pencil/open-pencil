import { diffLines, type ChangeObject } from 'diff'

import { graphFromPageSnapshot, type PageSnapshot } from '@open-pencil/core/editor'
import { diffPageLayersJSX } from '@open-pencil/core/tools'

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
  return sources.filter(Boolean).join('\n\n')
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

/**
 * Records what a finished call changed on its page. The structural diff is immediate; images
 * render afterwards from frozen copies of both states, so later edits cannot leak into them.
 */
export function recordToolChange(
  store: EditorStore,
  toolCallId: string,
  before: PageSnapshot,
  after: PageSnapshot
): ToolChange | null {
  const beforeGraph = graphFromPageSnapshot(store.graph, before)
  const afterGraph = graphFromPageSnapshot(store.graph, after)
  const pageId = after.values().next().value?.id
  if (!beforeGraph || !afterGraph || !pageId) return null
  // The same JSX diff `diff_jsx` returns decides which layers changed.
  const layers = diffPageLayersJSX(beforeGraph, afterGraph, pageId)
  if (layers.length === 0) return null
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
