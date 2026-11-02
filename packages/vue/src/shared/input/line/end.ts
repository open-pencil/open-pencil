import type { Editor } from '@open-pencil/core'
import { isLineLike, lineWorldEnds, TRANSFORM_ZONE, type LineEnd } from '@open-pencil/core/geometry'
import { layerRotates } from '@open-pencil/scene-graph/generated'

import type { DragState } from '#vue/shared/input/types'

/**
 * The end handle of the only selected line under a canvas point: an end within the reach Figma
 * gives a corner handle, the nearer end winning on a short line.
 */
export function lineEndAt(
  editor: Editor,
  cx: number,
  cy: number
): { nodeId: string; end: LineEnd } | null {
  const { state } = editor
  if (state.selectedIds.size !== 1) return null
  const [id] = state.selectedIds
  const line = editor.graph.getNode(id)
  // A connector or sticky note is shaped by its own handles, never aimed as a line.
  if (!line || line.locked || !isLineLike(line) || !layerRotates(line)) return null
  const reach = TRANSFORM_ZONE.resizeReach / (editor.renderer?.zoom ?? state.zoom)
  const [start, end] = lineWorldEnds(editor.graph, line)
  const toStart = Math.hypot(start.x - cx, start.y - cy)
  const toEnd = Math.hypot(end.x - cx, end.y - cy)
  if (Math.min(toStart, toEnd) > reach) return null
  return { nodeId: id, end: toEnd <= toStart ? 'end' : 'start' }
}

/** Drags a selected line's end handle, aiming the line at the pointer. */
export function tryStartLineEndDrag(
  editor: Editor,
  cx: number,
  cy: number,
  setDrag: (drag: DragState) => void
): boolean {
  const hit = lineEndAt(editor, cx, cy)
  if (!hit) return false
  editor.lineEndBegin(hit.nodeId, hit.end, cx, cy)
  setDrag({
    type: 'line-end',
    commit: () => editor.lineEndCommit(),
    cancel: () => editor.lineEndCancel()
  })
  return true
}
