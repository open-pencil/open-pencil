import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'

import {
  handleBendHandleMove,
  handleNodeEditMouseUp,
  updateNodeEditHover
} from '#vue/canvas/node-edit-input/use'
import { handlePenDragMove, updatePenHover } from '#vue/canvas/pen-input/use'
import { createCanvasPointer } from '#vue/canvas/pointer/use'
import { createTextEditInput } from '#vue/canvas/text-edit/input'
import { handleToolMouseDown } from '#vue/canvas/tool-input/use'
import { createCanvasTransformInput } from '#vue/canvas/transform-input/use'
import { createClickCounter } from '#vue/shared/input/click-count'
import { resolveAutoLayoutHover } from '#vue/shared/input/auto-layout-hover'
import { handleDrawMove, handleDrawUp } from '#vue/shared/input/draw'
import { handleMoveMove, handleMoveUp } from '#vue/shared/input/move'
import { handleNodeEditMove } from '#vue/shared/input/node-edit'
import { setupPanZoom } from '#vue/shared/input/pan-zoom'
import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import { updateHoverCursor } from '#vue/shared/input/select'
import { useSpaceHeld } from '#vue/shared/input/space-key'
import type { DragState } from '#vue/shared/input/types'

/**
 * Wires pointer and mouse interaction to an OpenPencil canvas.
 *
 * This composable coordinates selection, dragging, resizing, rotation,
 * panning, drawing tools, scoped hit testing, and text-edit interaction.
 * It is primarily intended for editor shell components that own the canvas.
 */
export function useCanvasInput(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null,
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null,
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null,
  onCursorMove?: (cx: number, cy: number) => void
) {
  const drag = ref<DragState | null>(null)
  const cursorOverride = ref<string | null>(null)
  const autoLayoutPaddingEdit = ref<{
    nodeId: string
    side: 'top' | 'right' | 'bottom' | 'left'
    value: number
    previous: number
  } | null>(null)
  const selectedIdsBeforeClickSequence = ref<ReadonlySet<string>>(new Set())
  const panPreviewOffset = ref({ x: 0, y: 0 })
  const spaceHeld = useSpaceHeld()
  const { recordClick, getClickCount } = createClickCounter()

  const { getCoords, canvasToLocal, hitTestInScope, hitFns } = createCanvasPointer(
    canvasRef,
    editor,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle
  )

  function setDrag(d: DragState) {
    drag.value = d
  }

  function panPreviewCanvases() {
    return canvasRef.value?.parentElement?.querySelectorAll<HTMLCanvasElement>('canvas') ?? []
  }

  function applyPanPreview(dx: number, dy: number) {
    panPreviewOffset.value = { x: dx, y: dy }
    for (const canvas of panPreviewCanvases()) {
      canvas.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      canvas.style.transformOrigin = '0 0'
      canvas.style.willChange = 'transform'
    }
  }

  function clearPanPreview() {
    panPreviewOffset.value = { x: 0, y: 0 }
    for (const canvas of panPreviewCanvases()) {
      canvas.style.transform = ''
      canvas.style.transformOrigin = ''
      canvas.style.willChange = ''
    }
  }

  function updatePanPreview(d: DragState, e: MouseEvent): boolean {
    if (d.type !== 'pan') return false
    applyPanPreview(e.clientX - d.startScreenX, e.clientY - d.startScreenY)
    return true
  }

  function commitPanPreview(d: DragState): boolean {
    if (d.type !== 'pan') return false
    editor.state.panX = d.startPanX + panPreviewOffset.value.x
    editor.state.panY = d.startPanY + panPreviewOffset.value.y
    editor.requestRepaint()
    requestAnimationFrame(clearPanPreview)
    return true
  }

  const { handleTextEditClick, onDblClick: onTextDblClick } = createTextEditInput({
    editor,
    getCoords,
    hitTestInScope,
    hitTestSectionTitle,
    hitTestComponentLabel,
    getClickCount,
    wasSelectedBeforeClickSequence: (id) => selectedIdsBeforeClickSequence.value.has(id),
    setDrag
  })

  const {
    tryStartRotation,
    handleRotateMove,
    handleTextSelectMove,
    handleMarqueeMove
  } = createCanvasTransformInput(editor, canvasToLocal, setDrag)

  function paddingValue(node: SceneNode, side: 'top' | 'right' | 'bottom' | 'left') {
    if (side === 'top') return node.paddingTop
    if (side === 'right') return node.paddingRight
    if (side === 'bottom') return node.paddingBottom
    return node.paddingLeft
  }

  function paddingKey(side: 'top' | 'right' | 'bottom' | 'left') {
    if (side === 'top') return 'paddingTop' as const
    if (side === 'right') return 'paddingRight' as const
    if (side === 'bottom') return 'paddingBottom' as const
    return 'paddingLeft' as const
  }

  function startAutoLayoutPaddingEdit(e: MouseEvent): boolean {
    const { cx, cy } = getCoords(e)
    const hover = resolveAutoLayoutHover(cx, cy, editor)
    if (hover?.kind !== 'padding' && hover?.kind !== 'padding-value') return false
    if (!hover.side) return false
    const node = editor.graph.getNode(hover.nodeId)
    if (!node) return false
    const value = paddingValue(node, hover.side)
    autoLayoutPaddingEdit.value = {
      nodeId: node.id,
      side: hover.side,
      value,
      previous: value
    }
    e.preventDefault()
    e.stopPropagation()
    return true
  }

  function updateAutoLayoutPaddingEdit(value: number) {
    const edit = autoLayoutPaddingEdit.value
    if (!edit || !Number.isFinite(value)) return
    const next = Math.max(0, value)
    autoLayoutPaddingEdit.value = { ...edit, value: next }
    editor.updateNode(edit.nodeId, { [paddingKey(edit.side)]: next })
  }

  function commitAutoLayoutPaddingEdit(value: number) {
    const edit = autoLayoutPaddingEdit.value
    if (!edit || !Number.isFinite(value)) {
      autoLayoutPaddingEdit.value = null
      return
    }
    const next = Math.max(0, value)
    editor.updateNode(edit.nodeId, { [paddingKey(edit.side)]: edit.previous })
    editor.updateNodeWithUndo(edit.nodeId, { [paddingKey(edit.side)]: next }, 'Update padding')
    autoLayoutPaddingEdit.value = null
  }

  function cancelAutoLayoutPaddingEdit() {
    const edit = autoLayoutPaddingEdit.value
    if (edit) editor.updateNode(edit.nodeId, { [paddingKey(edit.side)]: edit.previous })
    autoLayoutPaddingEdit.value = null
  }

  function onDblClick(e: MouseEvent) {
    if (startAutoLayoutPaddingEdit(e)) return
    onTextDblClick(e)
  }

  function onMouseDown(e: MouseEvent) {
    const paddingEdit = autoLayoutPaddingEdit.value
    if (paddingEdit) {
      commitAutoLayoutPaddingEdit(paddingEdit.value)
    }
    if (!editor.state.editingTextId) canvasRef.value?.focus()
    editor.setHoveredNode(null)
    const { sx, sy, cx, cy } = getCoords(e)

    const selectedIdsBeforeMouseDown = new Set(editor.state.selectedIds)
    const clickCount = recordClick(sx, sy)
    if (clickCount === 1) selectedIdsBeforeClickSequence.value = selectedIdsBeforeMouseDown
    handleToolMouseDown({
      event: e,
      cx,
      cy,
      editor,
      hitFns,
      cursorOverride,
      setDrag,
      tryStartRotation,
      handleTextEditClick
    })
  }

  function onMouseMove(e: MouseEvent) {
    if (onCursorMove) {
      const { cx, cy } = getCoords(e)
      onCursorMove(cx, cy)
    }

    if (!drag.value) {
      const { cx, cy } = getCoords(e)
      updatePenHover(cx, cy, editor)
    }

    if (!drag.value) {
      const { cx, cy } = getCoords(e)
      updateNodeEditHover(editor, cx, cy)
    }

    if (!drag.value && editor.state.activeTool === 'SELECT') {
      const { cx, cy } = getCoords(e)
      cursorOverride.value = updateHoverCursor(cx, cy, editor, hitFns)
      editor.setAutoLayoutHover(resolveAutoLayoutHover(cx, cy, editor))
    }

    if (!drag.value) return
    const d = drag.value

    if (d.type === 'pan') {
      updatePanPreview(d, e)
      return
    }

    const { cx, cy } = getCoords(e)

    if (d.type === 'rotate') {
      handleRotateMove(d, cx, cy, e.shiftKey)
      return
    }
    if (d.type === 'move') {
      handleMoveMove(d, cx, cy, editor)
      return
    }
    if (d.type === 'text-select') {
      handleTextSelectMove(cx, cy)
      return
    }
    if (d.type === 'resize') {
      applyResize(d, cx, cy, e.shiftKey, editor)
      return
    }

    if (d.type === 'pen-drag') {
      handlePenDragMove(d, cx, cy, spaceHeld.value, e, editor)
      return
    }

    if (d.type === 'edit-node' || d.type === 'edit-handle') {
      handleNodeEditMove(d, cx, cy, editor, e.altKey, e.metaKey || e.ctrlKey, e.shiftKey)
      return
    }

    if (d.type === 'bend-handle') {
      handleBendHandleMove(d, cx, cy, e, editor)
      return
    }

    if (d.type === 'draw') {
      handleDrawMove(d, cx, cy, e.shiftKey, editor)
      return
    }

    handleMarqueeMove(d, cx, cy)
  }

  function onMouseUp() {
    if (!drag.value) return
    const d = drag.value

    if (handleNodeEditMouseUp(drag, editor)) return

    if (commitPanPreview(d)) {
      drag.value = null
      cursorOverride.value = null
      return
    }

    if (d.type === 'move') handleMoveUp(d, editor)
    else if (d.type === 'text-select') {
      drag.value = null
      return
    } else if (d.type === 'resize') commitResizePreview(d, editor)
    else if (d.type === 'pen-drag') {
      const penState = editor.state.penState as
        | (typeof editor.state.penState & {
            pendingClose?: boolean
          })
        | null
      if (penState?.pendingClose) {
        editor.penCommit(true)
      }
      drag.value = null
      return
    } else if (d.type === 'rotate') {
      const preview = editor.state.rotationPreview
      if (preview) {
        editor.updateNode(d.nodeId, { rotation: preview.angle })
        editor.commitRotation(d.nodeId, d.origRotation)
      }
      editor.setRotationPreview(null)
    } else if (d.type === 'draw') handleDrawUp(d, editor)
    else if (d.type === 'marquee') editor.setMarquee(null)

    drag.value = null
    cursorOverride.value = null
  }

  useEventListener(canvasRef, 'dblclick', onDblClick)
  useEventListener(canvasRef, 'mousedown', onMouseDown)
  useEventListener(canvasRef, 'mousemove', onMouseMove)
  useEventListener(canvasRef, 'mouseup', onMouseUp)
  useEventListener(canvasRef, 'mouseleave', () => {
    if (!drag.value) {
      editor.setHoveredNode(null)
    }
  })
  useEventListener(window, 'mouseup', () => {
    if (drag.value) onMouseUp()
  })

  setupPanZoom(canvasRef, editor, drag, onMouseDown, onMouseMove, onMouseUp)
  return {
    drag,
    cursorOverride,
    autoLayoutPaddingEdit,
    updateAutoLayoutPaddingEdit,
    commitAutoLayoutPaddingEdit,
    cancelAutoLayoutPaddingEdit
  }
}
