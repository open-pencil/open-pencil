import type { CornerRadiusHover, Editor } from '@open-pencil/core/editor'
import {
  cornerRadiusAtPoint,
  cornerRadiusChanges,
  cornerRadiusHandleLayout,
  createSceneGeometry,
  dragsSingleCorner,
  hitTestCornerRadiusHandles
} from '@open-pencil/core/geometry'

import { editorMessages } from '#vue/i18n/messages/editor'
import { isPastPointerDragThreshold } from '#vue/shared/input/drag-threshold'
import type { DragCornerRadius, DragState } from '#vue/shared/input/types'

/** Figma leaves the radius alone until the pointer has moved this far from the handle. */
const RADIUS_DRAG_THRESHOLD_PX = 5

/**
 * The corner radius handles to show for the pointer at a screen point: those of the only selected
 * rectangle while the pointer is over it or one of its handles, with the handle under the pointer.
 */
export function resolveCornerRadiusHover(
  editor: Editor,
  sx: number,
  sy: number,
  altKey: boolean
): CornerRadiusHover | null {
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
  const handles = cornerRadiusHandleLayout(node, geometry, state)
  if (!handles) return null
  const pointer = { x: sx, y: sy }
  const corner = hitTestCornerRadiusHandles(handles, pointer)
  if (!corner) {
    const local = geometry.screenToLocal(node, pointer, state)
    const inside =
      local && local.x >= 0 && local.y >= 0 && local.x <= node.width && local.y <= node.height
    if (!inside) return null
  }
  return {
    nodeId: node.id,
    single: dragsSingleCorner(node, altKey),
    corner,
    label: editorMessages.get().cornerRadius,
    pointer
  }
}

/**
 * Starts dragging the corner radius handle under the pointer, if any. The radius follows the
 * pointer rather than the distance dragged, Shift rounds it to tens, and each drag is one undo
 * step, as in Figma desktop.
 */
export function tryStartCornerRadiusDrag(
  editor: Editor,
  sx: number,
  sy: number,
  altKey: boolean,
  setDrag: (drag: DragState) => void
): boolean {
  const found = resolveCornerRadiusHover(editor, sx, sy, altKey)
  if (!found?.corner) return false
  const hover: CornerRadiusHover = found
  const corner = found.corner
  const preview = editor.beginNodePreview('Change corner radius')
  let moved = false

  function update(screenX: number, screenY: number, shiftKey: boolean) {
    moved ||= isPastPointerDragThreshold(sx, sy, screenX, screenY, RADIUS_DRAG_THRESHOLD_PX)
    const node = editor.graph.getNode(hover.nodeId)
    if (!moved || !node) return
    const pointer = { x: screenX, y: screenY }
    const local = createSceneGeometry(editor.graph).screenToLocal(node, pointer, editor.state)
    if (!local) return
    const radius = cornerRadiusAtPoint(node, corner, local, shiftKey)
    preview.update(node.id, cornerRadiusChanges(node, corner, radius, hover.single))
    editor.setCornerRadiusHover({ ...hover, pointer })
  }

  const drag: DragCornerRadius = {
    type: 'corner-radius',
    update,
    commit: () => preview.commit(),
    cancel: () => preview.cancel()
  }
  editor.setCornerRadiusHover(hover)
  setDrag(drag)
  return true
}
