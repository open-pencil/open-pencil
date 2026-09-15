import { ROTATION_SNAP_DEGREES } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import { createSceneGeometry } from '@open-pencil/core/geometry'

import {
  hitTestCornerRotationByMatrix,
  hitTestTopRotationHandleByMatrix
} from '#vue/shared/input/geometry'
import type { DragRotate, DragState } from '#vue/shared/input/types'

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

  const geometry = createSceneGeometry(editor.graph, editor.state.rotationPreview)
  const center = geometry.rotationOrigin(node)

  const zoom = editor.renderer?.zoom ?? 1
  const hitsRotationHandle =
    hitTestTopRotationHandleByMatrix(
      cx,
      cy,
      node,
      editor.graph,
      zoom,
      editor.state.rotationPreview
    ) ||
    hitTestCornerRotationByMatrix(cx, cy, node, editor.graph, zoom, editor.state.rotationPreview)
  if (!hitsRotationHandle) return false
  const startAngle = Math.atan2(cy - center.y, cx - center.x) * (180 / Math.PI)
  setDrag({
    type: 'rotate',
    nodeId: id,
    centerX: center.x,
    centerY: center.y,
    startAngle,
    origRotation: geometry.node(node).rotation,
    rotationDirection: geometry.rotationDirection(node)
  })
  editor.setRotationPreview({ nodeId: id, angle: geometry.node(node).rotation })
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
  let rotation = d.origRotation + delta * d.rotationDirection

  if (shiftKey) {
    rotation = Math.round(rotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES
  }

  editor.setRotationPreview({ nodeId: d.nodeId, angle: normalizeRotation(rotation) })
}
