import type { Editor, ShapeHandleHover } from '@open-pencil/core/editor'
import {
  cornerRadiusAtPoint,
  cornerRadiusChanges,
  createSceneGeometry,
  dragsSingleCorner,
  hitTestShapeHandles,
  isRadiusHandle,
  pointCountAtPoint,
  shapeHandleLayout,
  starRatioAtPoint,
  type ShapeHandleKind
} from '@open-pencil/core/geometry'
import type { SceneNode, Vector } from '@open-pencil/scene-graph'

import { editorMessages } from '#vue/i18n/messages/editor'
import { isPastPointerDragThreshold } from '#vue/shared/input/drag-threshold'
import type { DragShapeHandle, DragState } from '#vue/shared/input/types'

/** Figma leaves the shape alone until the pointer has moved this far from the handle. */
const HANDLE_DRAG_THRESHOLD_PX = 5

function handleLabel(handle: ShapeHandleKind | null): string {
  const messages = editorMessages.get()
  if (handle === 'count') return messages.pointCount
  if (handle === 'ratio') return messages.starRatio
  return messages.cornerRadius
}

function undoLabel(handle: ShapeHandleKind): string {
  if (handle === 'count') return 'Change point count'
  if (handle === 'ratio') return 'Change star ratio'
  return 'Change corner radius'
}

/**
 * The handles to show for the pointer at a screen point: those of the only selected shape while
 * the pointer is over it or one of its handles, with the handle under the pointer.
 */
export function resolveShapeHandleHover(
  editor: Editor,
  sx: number,
  sy: number,
  altKey: boolean
): ShapeHandleHover | null {
  const { state } = editor
  if (
    state.activeTool !== 'SELECT' ||
    state.selectedIds.size !== 1 ||
    state.editingTextId ||
    state.nodeEditState ||
    state.penState ||
    state.gradientEdit
  )
    return null
  const [id] = state.selectedIds
  const node = editor.graph.getNode(id)
  if (!node || node.locked) return null
  const geometry = createSceneGeometry(editor.graph, state.rotationPreview)
  const handles = shapeHandleLayout(node, geometry, state)
  if (!handles) return null
  const pointer = { x: sx, y: sy }
  const handle = hitTestShapeHandles(handles, pointer)
  if (!handle) {
    const local = geometry.screenToLocal(node, pointer, state)
    const inside =
      local && local.x >= 0 && local.y >= 0 && local.x <= node.width && local.y <= node.height
    if (!inside) return null
  }
  return {
    nodeId: node.id,
    single: dragsSingleCorner(node, altKey),
    handle,
    label: handleLabel(handle),
    pointer
  }
}

/** The fields a handle sets for the node-local point it is dragged to. */
function handleChanges(
  node: SceneNode,
  handle: ShapeHandleKind,
  local: Vector,
  single: boolean,
  shiftKey: boolean
): Partial<SceneNode> {
  if (handle === 'count') return { pointCount: pointCountAtPoint(node, local) }
  if (handle === 'ratio') return { starInnerRadius: starRatioAtPoint(node, local) }
  const radius = cornerRadiusAtPoint(node, handle, local, shiftKey)
  return cornerRadiusChanges(node, handle, radius, single)
}

/** How far a count or ratio handle's centre lies from where it was grabbed, in the node's pixels. */
function grabOffset(editor: Editor, node: SceneNode, handle: ShapeHandleKind, screen: Vector) {
  if (isRadiusHandle(handle)) return { x: 0, y: 0 }
  const geometry = createSceneGeometry(editor.graph, editor.state.rotationPreview)
  const centre = shapeHandleLayout(node, geometry, editor.state)?.find(
    (candidate) => candidate.handle === handle
  )
  const grabbed = geometry.screenToLocal(node, screen, editor.state)
  const held = centre && geometry.screenToLocal(node, centre.point, editor.state)
  return grabbed && held ? { x: held.x - grabbed.x, y: held.y - grabbed.y } : { x: 0, y: 0 }
}

/**
 * Starts dragging the shape handle under the pointer, if any, as in Figma desktop. A radius
 * follows the pointer rather than the distance dragged and Shift rounds it to tens; the count and
 * ratio handles keep where they were grabbed. Each drag is one undo step.
 */
export function tryStartShapeHandleDrag(
  editor: Editor,
  sx: number,
  sy: number,
  altKey: boolean,
  setDrag: (drag: DragState) => void
): boolean {
  const found = resolveShapeHandleHover(editor, sx, sy, altKey)
  const start = found && editor.graph.getNode(found.nodeId)
  if (!found?.handle || !start) return false
  const hover: ShapeHandleHover = found
  const handle = found.handle
  const offset = grabOffset(editor, start, handle, { x: sx, y: sy })
  const preview = editor.beginNodePreview(undoLabel(handle))
  let moved = false

  function update(screenX: number, screenY: number, shiftKey: boolean) {
    moved ||= isPastPointerDragThreshold(sx, sy, screenX, screenY, HANDLE_DRAG_THRESHOLD_PX)
    const node = editor.graph.getNode(hover.nodeId)
    if (!moved || !node) return
    const pointer = { x: screenX, y: screenY }
    const local = createSceneGeometry(editor.graph).screenToLocal(node, pointer, editor.state)
    if (!local) return
    const target = { x: local.x + offset.x, y: local.y + offset.y }
    preview.update(node.id, handleChanges(node, handle, target, hover.single, shiftKey))
    editor.setShapeHandleHover({ ...hover, pointer })
  }

  const drag: DragShapeHandle = {
    type: 'shape-handle',
    update,
    commit: () => preview.commit(),
    cancel: () => preview.cancel()
  }
  editor.setShapeHandleHover(hover)
  setDrag(drag)
  return true
}
