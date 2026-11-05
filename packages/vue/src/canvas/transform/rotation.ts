import { compact, isEqual } from 'es-toolkit'
import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core'
import { ROTATION_SNAP_DEGREES } from '@open-pencil/core/constants'
import { createSceneGeometry } from '@open-pencil/core/geometry'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { placeRotatedAbout, selectionPlacement } from '@open-pencil/scene-graph/coordinate'
import { layerRotates } from '@open-pencil/scene-graph/generated'

import {
  hitTestBoxRotation,
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
  const box = selectionBox(editor)
  if (!box || !hitTestBoxRotation(cx, cy, box, editor.renderer?.zoom ?? 1)) return false
  const members = compact(
    [...editor.state.selectedIds].map((id) => {
      const node = editor.graph.getNode(id)
      // FigJam keeps sticky notes upright, and a connector follows its ends.
      if (!node || node.locked || !layerRotates(node)) return undefined
      return { nodeId: id, placement: selectionPlacement(node, editor.graph) }
    })
  )
  if (members.length === 0) return false
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const startAngle = Math.atan2(cy - centerY, cx - centerX) * (180 / Math.PI)
  setDrag({ type: 'rotate-selection', centerX, centerY, startAngle, members })
  return true
}

/**
 * Turns every member about the box's center; Shift snaps the turn to the rotation step. The box
 * stays upright around the turning layers, as Figma draws it.
 */
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
  // An auto layout places its turned children again, as the commit's layout will, and Figma's.
  for (const parentId of autoLayoutParents(editor, d)) {
    editor.graph.runPreviewUpdates(() => computeAllLayouts(editor.graph, parentId))
  }
  editor.requestRepaint()
}

/** The auto layout frames that place some of the turning layers. */
function autoLayoutParents(editor: Editor, d: DragRotateSelection): Set<string> {
  const parents = new Set<string>()
  for (const { placement } of d.members) {
    const parentId = placement.node.parentId
    const parent = parentId ? editor.graph.getNode(parentId) : undefined
    if (parent && parent.layoutMode !== 'NONE' && placement.node.layoutPositioning !== 'ABSOLUTE') {
      parents.add(parent.id)
    }
  }
  return parents
}

function startingPlace({ placement }: DragRotateSelection['members'][number]) {
  const { x, y, rotation } = placement.node
  return { x, y, rotation }
}

/** Commits every member's turn and fits the groups around them, as one undo step. */
export function commitSelectionRotation(editor: Editor, dragState: DragRotateSelection) {
  const d = toRaw(dragState)
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
    editor.requestRepaint()
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
