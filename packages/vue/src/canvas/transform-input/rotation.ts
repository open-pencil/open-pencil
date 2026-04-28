import {
  hitTestCornerRotationByMatrix,
  hitTestTopRotationHandleByMatrix
} from '#vue/shared/input/geometry'

import { getAbsolutePositionFull } from '@open-pencil/core/canvas'
import { ROTATION_SNAP_DEGREES } from '@open-pencil/core/constants'

import type { DragRotate, DragState } from '#vue/shared/input/types'
import type { Editor } from '@open-pencil/core/editor'

type SetDrag = (drag: DragState) => void

function normalizeRotation(angle: number) {
  return ((((angle + 180) % 360) + 360) % 360) - 180
}

export function tryStartRotation(
  editor: Editor,
  setDrag: SetDrag,
  cx: number,
  cy: number
): boolean {
  if (editor.state.selectedIds.size !== 1) return false
  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (!node || node.locked) return false

  const abs = getAbsolutePositionFull(node, editor.graph)

  const zoom = editor.renderer?.zoom ?? 1
  const hitsRotationHandle =
    hitTestTopRotationHandleByMatrix(cx, cy, node, editor.graph, zoom) ||
    hitTestCornerRotationByMatrix(cx, cy, node, editor.graph, zoom)
  if (!hitsRotationHandle) return false
  const startAngle = Math.atan2(cy - abs.centerY, cx - abs.centerX) * (180 / Math.PI)
  setDrag({
    type: 'rotate',
    nodeId: id,
    centerX: abs.centerX,
    centerY: abs.centerY,
    startAngle,
    origRotation: node.rotation
  })
  return true
}

export function handleRotateMove(
  editor: Editor,
  d: DragRotate,
  sx: number,
  sy: number,
  shiftKey: boolean
) {
  const currentAngle = Math.atan2(sy - d.centerY, sx - d.centerX) * (180 / Math.PI)
  const delta = normalizeRotation(currentAngle - d.startAngle)
  let rotation = d.origRotation + delta

  if (shiftKey) {
    rotation = Math.round(rotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES
  }

  editor.setRotationPreview({ nodeId: d.nodeId, angle: normalizeRotation(rotation) })
}
