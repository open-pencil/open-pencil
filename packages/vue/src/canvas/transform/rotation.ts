import { compact, isEqual } from 'es-toolkit'
import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core'
import { ROTATION_SNAP_DEGREES } from '@open-pencil/core/constants'
import { createSceneGeometry, selectionKey } from '@open-pencil/core/geometry'
import {
  placeRotatedAbout,
  selectionPlacement,
  turnPoint
} from '@open-pencil/scene-graph/coordinate'
import { layerRotates } from '@open-pencil/scene-graph/generated'

import {
  hitTestFrameRotation,
  hitTestCornerRotationByMatrix,
  hitTestTopRotationHandleByMatrix
} from '#vue/shared/input/geometry'
import { selectionBox } from '#vue/shared/input/resize/selection'
import type { DragRotate, DragRotateSelection, DragState } from '#vue/shared/input/types'

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
  if (editor.state.selectedIds.size > 1) return tryStartSelectionRotation(editor, setDrag, cx, cy)
  if (editor.state.selectedIds.size !== 1) return false
  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  // FigJam keeps sticky notes upright, and a connector follows its ends.
  if (!node || node.locked || !layerRotates(node)) return false

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

/** Starts turning a multi-selection from its box's rotation handle or corner zones. */
function tryStartSelectionRotation(
  editor: Editor,
  setDrag: SetDrag,
  cx: number,
  cy: number
): boolean {
  const frame = selectionBox(editor)
  if (!frame || !hitTestFrameRotation(cx, cy, frame, editor.renderer?.zoom ?? 1)) return false
  const members = compact(
    [...editor.state.selectedIds].map((id) => {
      const node = editor.graph.getNode(id)
      if (!node || node.locked) return undefined
      return { nodeId: id, placement: selectionPlacement(node, editor.graph) }
    })
  )
  if (members.length === 0) return false
  const { box } = frame
  const center = turnPoint({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, frame.angle)
  const startAngle = Math.atan2(cy - center.y, cx - center.x) * (180 / Math.PI)
  setDrag({
    type: 'rotate-selection',
    centerX: center.x,
    centerY: center.y,
    startAngle,
    frame,
    members
  })
  editor.setSelectionRotationPreview(frame)
  return true
}

/** Turns every member about the bounds' center; Shift snaps the turn to the rotation step. */
export function handleSelectionRotateMove(
  editor: Editor,
  dragState: DragRotateSelection,
  sx: number,
  sy: number,
  shiftKey: boolean
) {
  const d = toRaw(dragState)
  const currentAngle = Math.atan2(sy - d.centerY, sx - d.centerX) * (180 / Math.PI)
  let delta = normalizeRotation(currentAngle - d.startAngle)
  if (shiftKey) delta = Math.round(delta / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES
  const pivot = { x: d.centerX, y: d.centerY }
  for (const { nodeId, placement } of d.members) {
    editor.graph.updateNodePreview(nodeId, placeRotatedAbout(placement, pivot, delta))
  }
  // The box turns with its layers: the same box, its center kept at the pivot in the new frame.
  const angle = d.frame.angle + delta
  const { width, height } = d.frame.box
  const center = turnPoint(pivot, -angle)
  editor.setSelectionRotationPreview({
    box: { x: center.x - width / 2, y: center.y - height / 2, width, height },
    angle
  })
}

function startingPlace({ placement }: DragRotateSelection['members'][number]) {
  const { x, y, rotation } = placement.node
  return { x, y, rotation }
}

/** Commits every member's turn and fits the groups around them, as one undo step. */
export function commitSelectionRotation(editor: Editor, dragState: DragRotateSelection) {
  const d = toRaw(dragState)
  const angle = editor.state.selectionRotationPreview?.angle
  editor.setSelectionRotationPreview(null)
  const finals = d.members.map((member) => {
    const node = editor.graph.getNode(member.nodeId)
    return node ? { member, final: { x: node.x, y: node.y, rotation: node.rotation } } : null
  })
  const turned = compact(finals).filter(
    ({ member, final }) => !isEqual(final, startingPlace(member))
  )
  if (turned.length === 0) return
  editor.undo.runBatch('Rotate', () => {
    for (const { member, final } of turned) {
      editor.graph.updateNodePreview(member.nodeId, startingPlace(member))
      editor.updateNodeWithUndo(member.nodeId, final, 'Rotate')
    }
    const parentIds = compact(
      turned.map(({ member }) => editor.graph.getNode(member.nodeId)?.parentId)
    )
    editor.fitEnclosingGroups(new Set(parentIds))
    // The selection's box stays turned for as long as this selection lasts, as in Figma.
    if (angle !== undefined) keepSelectionAngle(editor, angle)
  })
}

/** Records the angle the selection's box was turned to, undoable with the rotation. */
function keepSelectionAngle(editor: Editor, angle: number) {
  const previous = editor.state.selectionAngle
  const next = { key: selectionKey(editor.state.selectedIds), angle }
  editor.setSelectionAngle(next)
  editor.undo.push({
    label: 'Rotate',
    forward: () => editor.setSelectionAngle(next),
    inverse: () => editor.setSelectionAngle(previous)
  })
}

/** Puts back a rotation the pointer abandoned: a layer's preview, or every member's place. */
export function cancelRotationDrag(editor: Editor, dragState: DragState | null) {
  if (dragState?.type === 'rotate') {
    if (editor.state.rotationPreview?.nodeId === dragState.nodeId) editor.setRotationPreview(null)
  } else if (dragState?.type === 'rotate-selection') {
    for (const member of toRaw(dragState).members) {
      editor.graph.updateNodePreview(member.nodeId, startingPlace(member))
    }
    editor.setSelectionRotationPreview(null)
  }
}

/** Commits a layer's previewed rotation, or every member of a multi-selection's turn. */
export function commitRotationDrag(editor: Editor, d: DragRotate | DragRotateSelection) {
  if (d.type === 'rotate-selection') {
    commitSelectionRotation(editor, d)
    return
  }
  const preview = editor.state.rotationPreview
  if (preview?.nodeId === d.nodeId && preview.angle !== d.origRotation) {
    editor.updateNode(d.nodeId, { rotation: preview.angle })
    editor.commitRotation(d.nodeId, d.origRotation)
  }
  if (editor.state.rotationPreview === preview) editor.setRotationPreview(null)
}
