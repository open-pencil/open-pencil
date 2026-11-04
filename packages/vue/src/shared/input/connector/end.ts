import type { Editor } from '@open-pencil/core'
import { connectorScreenEnds } from '@open-pencil/core/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { DragState } from '#vue/shared/input/types'

/** How near a connector's end handle the pointer picks it, in screen pixels. */
const CONNECTOR_HANDLE_HIT_RADIUS = 8

/** The end handle of the only selected connector under a screen point, if any. */
export function connectorEndAt(
  editor: Editor,
  sx: number,
  sy: number
): { connectorId: string; end: 'connectorStart' | 'connectorEnd' } | null {
  const { state } = editor
  if (state.selectedIds.size !== 1) return null
  const [id] = state.selectedIds
  const connector = editor.graph.getNode(id)
  if (connector?.type !== 'CONNECTOR' || connector.locked) return null
  const ends = connectorScreenEnds(editor.graph, connector, state, state.rotationPreview)
  if (!ends) return null
  const near = (point: Vector) =>
    Math.hypot(point.x - sx, point.y - sy) <= CONNECTOR_HANDLE_HIT_RADIUS
  if (near(ends.end)) return { connectorId: id, end: 'connectorEnd' }
  if (near(ends.start)) return { connectorId: id, end: 'connectorStart' }
  return null
}

/** Drags a selected connector's end handle, attaching it where it is dropped. */
export function tryStartConnectorEndDrag(
  editor: Editor,
  sx: number,
  sy: number,
  setDrag: (drag: DragState) => void
): boolean {
  const hit = connectorEndAt(editor, sx, sy)
  if (!hit) return false
  editor.connectorEndpointBegin(hit.connectorId, hit.end)
  setDrag({
    type: 'connector-end',
    commit: () => editor.connectorEndpointCommit(),
    cancel: () => editor.connectorEndpointCancel()
  })
  return true
}
