import { useEventListener } from '@vueuse/core'
import { onScopeDispose, ref, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

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
import { resolveAutoLayoutHover } from '#vue/shared/input/auto-layout-hover'
import { createClickCounter } from '#vue/shared/input/click-count'
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
  onCursorMove?: (cx: number, cy: number) => void,
  onActivate?: () => void,
  isEnabled: () => boolean = () => true
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
  const lastPointer = ref<{ cx: number; cy: number } | null>(null)
  const pointerInside = ref(false)
  let altHeld = false
  let metaHeld = false
  let controlHeld = false
  const spaceHeld = useSpaceHeld()
  const { recordClick, getClickCount } = createClickCounter()

  const { getCoords, canvasToLocal, hitTestInScope, hitFns } = createCanvasPointer(
    canvasRef,
    editor,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle
  )

  function canMeasure() {
    return (
      pointerInside.value &&
      !drag.value &&
      editor.state.activeTool === 'SELECT' &&
      editor.state.selectedIds.size > 0 &&
      !editor.state.editingTextId &&
      !editor.state.nodeEditState &&
      !editor.state.penState
    )
  }

  function refreshMeasurement() {
    const mode = altHeld && canMeasure() ? (metaHeld || controlHeld ? 'deep' : 'shallow') : 'off'
    editor.setMeasurementMode(mode)
    const pointer = lastPointer.value
    if (!pointer || drag.value || editor.state.activeTool !== 'SELECT' || !pointerInside.value)
      return
    cursorOverride.value = updateHoverCursor(
      pointer.cx,
      pointer.cy,
      editor,
      hitFns,
      mode === 'deep'
    )
    editor.setAutoLayoutHover(
      mode === 'off' ? resolveAutoLayoutHover(pointer.cx, pointer.cy, editor) : null
    )
  }

  function updateModifier(code: string, held: boolean) {
    if (!isEnabled()) return
    if (code === 'AltLeft' || code === 'AltRight') altHeld = held
    if (code === 'MetaLeft' || code === 'MetaRight') metaHeld = held
    if (code === 'ControlLeft' || code === 'ControlRight') controlHeld = held
    if (code.startsWith('Alt') || code.startsWith('Meta') || code.startsWith('Control')) {
      refreshMeasurement()
    }
  }

  function resetMeasurementModifiers() {
    altHeld = false
    metaHeld = false
    controlHeld = false
    editor.setMeasurementMode('off')
  }

  function setDrag(d: DragState) {
    editor.setMeasurementMode('off')
    drag.value = d
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
    handlePanMove,
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
    onActivate?.()
    if (!isEnabled()) return
    editor.setMeasurementMode('off')
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
      sx,
      sy,
      editor,
      hitFns,
      cursorOverride,
      setDrag,
      tryStartRotation,
      handleTextEditClick
    })
  }

  function onMouseMove(e: MouseEvent) {
    if (!isEnabled()) return
    pointerInside.value = true
    const coords = getCoords(e)
    lastPointer.value = { cx: coords.cx, cy: coords.cy }
    if (onCursorMove) {
      onCursorMove(coords.cx, coords.cy)
    }

    if (!drag.value) {
      const { cx, cy } = coords
      updatePenHover(cx, cy, editor)
    }

    if (!drag.value) {
      const { cx, cy } = coords
      updateNodeEditHover(editor, cx, cy)
    }

    if (!drag.value && editor.state.activeTool === 'SELECT') {
      const { cx, cy } = coords
      cursorOverride.value = updateHoverCursor(
        cx,
        cy,
        editor,
        hitFns,
        editor.state.measurementMode === 'deep'
      )
      editor.setAutoLayoutHover(
        editor.state.measurementMode === 'off' ? resolveAutoLayoutHover(cx, cy, editor) : null
      )
    }

    if (!drag.value) return
    const d = drag.value

    if (d.type === 'pan') {
      handlePanMove(d, e)
      return
    }

    const { sx, sy, cx, cy } = getCoords(e)

    if (d.type === 'rotate') {
      handleRotateMove(d, cx, cy, e.shiftKey)
      return
    }
    if (d.type === 'move') {
      handleMoveMove(d, cx, cy, sx, sy, editor)
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
    if (!isEnabled()) return
    if (!drag.value) return
    const d = drag.value

    if (handleNodeEditMouseUp(drag, editor)) return

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
    refreshMeasurement()
  }

  useEventListener(canvasRef, 'dblclick', onDblClick)
  useEventListener(canvasRef, 'mousedown', onMouseDown)
  useEventListener(canvasRef, 'mousemove', onMouseMove)
  useEventListener(canvasRef, 'mouseup', onMouseUp)
  useEventListener(window, 'keydown', (event) => updateModifier(event.code, true))
  useEventListener(window, 'keyup', (event) => updateModifier(event.code, false))
  useEventListener(window, 'blur', resetMeasurementModifiers)
  useEventListener(canvasRef, 'mouseleave', () => {
    pointerInside.value = false
    if (!isEnabled()) return
    editor.setMeasurementMode('off')
    if (!drag.value) {
      editor.setHoveredNode(null)
    }
  })
  useEventListener(window, 'mouseup', () => {
    if (drag.value) onMouseUp()
  })

  const stopToolListener = editor.onEditorEvent('tool:changed', () => {
    if (!isEnabled()) return
    editor.setMeasurementMode('off')
  })
  onScopeDispose(stopToolListener)

  setupPanZoom(canvasRef, editor, drag, onMouseDown, onMouseMove, onMouseUp)
  return {
    drag,
    cursorOverride,
    autoLayoutPaddingEdit,
    updateAutoLayoutPaddingEdit,
    commitAutoLayoutPaddingEdit,
    cancelAutoLayoutPaddingEdit,
    cleanupInteractions() {
      cancelAutoLayoutPaddingEdit()
      drag.value = null
      cursorOverride.value = null
      pointerInside.value = false
      resetMeasurementModifiers()
    }
  }
}
