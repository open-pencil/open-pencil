import type { Editor } from '@open-pencil/core'
import {
  CONNECTOR_SEGMENT_HANDLE,
  connectorRouteHandles,
  connectorScreenLabel
} from '@open-pencil/core/geometry'

import { MOVE_CURSOR, buildResizeCursor } from '#vue/shared/input/geometry'
import type { DragState } from '#vue/shared/input/types'

/** How far past a line handle the pointer still picks it, in screen pixels. */
const LINE_HANDLE_SLACK = 3
/** How near a curve's handle the pointer picks it, in screen pixels. */
const CURVE_HANDLE_HIT_RADIUS = 8

/** The line handle of the only selected connector under a screen point, if any. */
function connectorLineAt(editor: Editor, sx: number, sy: number) {
  const { state } = editor
  if (state.selectedIds.size !== 1) return null
  const [id] = state.selectedIds
  const connector = editor.graph.getNode(id)
  if (connector?.type !== 'CONNECTOR' || connector.locked) return null
  // The label lies over the middle of its run, so it takes the press before that segment does.
  const plate = connectorScreenLabel(editor.graph, connector, state, state.rotationPreview)
  if (
    plate &&
    sx >= plate.x &&
    sx <= plate.x + plate.width &&
    sy >= plate.y &&
    sy <= plate.y + plate.height
  ) {
    return { connectorId: id, part: { kind: 'label' as const } }
  }
  const handles = connectorRouteHandles(editor.graph, connector, state, state.rotationPreview)
  const hit = handles.find((handle) => {
    const dx = Math.abs(sx - handle.at.x)
    const dy = Math.abs(sy - handle.at.y)
    if (handle.kind === 'curve') return Math.hypot(dx, dy) <= CURVE_HANDLE_HIT_RADIUS
    const along = Math.min(CONNECTOR_SEGMENT_HANDLE.length, handle.length) / 2 + LINE_HANDLE_SLACK
    const across = CONNECTOR_SEGMENT_HANDLE.thickness / 2 + LINE_HANDLE_SLACK
    return handle.vertical ? dx <= across && dy <= along : dx <= along && dy <= across
  })
  if (!hit) return null
  return {
    connectorId: id,
    part:
      hit.kind === 'curve'
        ? { kind: 'curve' as const }
        : { kind: 'segment' as const, index: hit.index },
    vertical: hit.kind === 'segment' && hit.vertical
  }
}

/**
 * The cursor over a selected connector's line handle, as FigJam shows it: a two-way arrow across
 * an elbow segment, the way it slides, and the four-way arrow over a curve's handle.
 */
export function connectorLineCursor(editor: Editor, cx: number, cy: number): string | null {
  const { panX, panY, zoom } = editor.state
  const hit = connectorLineAt(editor, cx * zoom + panX, cy * zoom + panY)
  if (!hit || hit.part.kind === 'label') return null
  if (hit.part.kind === 'curve') return MOVE_CURSOR
  return buildResizeCursor(hit.vertical ? 0 : 90)
}

/** Drags a selected connector's elbow segment, curve, or label by its handle. */
export function tryStartConnectorLineDrag(
  editor: Editor,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  setDrag: (drag: DragState) => void
): boolean {
  const hit = connectorLineAt(editor, sx, sy)
  if (!hit) return false
  editor.connectorLineBegin(hit.connectorId, hit.part, cx, cy)
  setDrag({
    type: 'connector-line',
    commit: () => editor.connectorLineCommit(),
    cancel: () => editor.connectorLineCancel()
  })
  return true
}
