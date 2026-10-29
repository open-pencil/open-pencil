import { useEventListener } from '@vueuse/core'
import { onScopeDispose, ref, watch, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { createAutoLayoutValueEdit } from '#vue/canvas/auto-layout/value-edit'
import { createGuideInput, selectedTopLevelGuideFrameId } from '#vue/canvas/guides/input'
import { createCanvasLabelEdit } from '#vue/canvas/labels/edit'
import { handlePenDragMove, updatePenHover } from '#vue/canvas/pen/input'
import { finishPencilDrag, handlePencilDragMove } from '#vue/canvas/pencil/input'
import { createCanvasPointer } from '#vue/canvas/pointer/use'
import { createTextEditInput } from '#vue/canvas/text-edit/input'
import { handleToolMouseDown } from '#vue/canvas/tools/input'
import { createCanvasTransformInput } from '#vue/canvas/transform/input'
import { finishMarquee } from '#vue/canvas/transform/marquee'
import {
  cancelNodeEditDrag,
  handleBendHandleMove,
  handleNodeEditPointerUp,
  updateNodeEditHover
} from '#vue/canvas/vector-input/input'
import { resolveAutoLayoutHover } from '#vue/shared/input/auto-layout-hover'
import { createClickCounter } from '#vue/shared/input/click-count'
import {
  attachModifiers,
  handleConnectorDrawMove,
  refreshConnectorDrag
} from '#vue/shared/input/connector/draw'
import { handleDrawMove } from '#vue/shared/input/draw'
import { cancelMove, handleMoveMove, handleMoveUp } from '#vue/shared/input/move/drag'
import { setupPanZoom } from '#vue/shared/input/pan/zoom'
import { applyResize, cancelResizePreview, commitResizePreview } from '#vue/shared/input/resize'
import { updateHoverCursor } from '#vue/shared/input/select'
import { resolveShapeHandleHover } from '#vue/shared/input/shape-handles'
import { useSpaceHeld } from '#vue/shared/input/space-key'
import { applyStickyScale } from '#vue/shared/input/sticky/scale'
import type { DragState } from '#vue/shared/input/types'
import { handleNodeEditMarqueeMove, handleNodeEditMove } from '#vue/shared/input/vector'

/**
 * Wires pointer and mouse interaction to an OpenPencil canvas.
 *
 * This composable coordinates selection, dragging, resizing, rotation,
 * panning, drawing tools, scoped hit testing, and text-edit interaction.
 * It is primarily intended for editor shell components that own the canvas.
 */
/** Drags Escape abandons, leaving the document as it was before the press. */
const ESCAPABLE_DRAGS: ReadonlySet<DragState['type']> = new Set<DragState['type']>([
  'draw',
  'gradient',
  'rotate',
  'connector-draw',
  'connector-end',
  'connector-line',
  'line-end'
])

export function useCanvasInput(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null,
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null,
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null,
  onCursorMove?: (cx: number, cy: number) => void,
  onActivate?: () => void,
  isEnabled: () => boolean = () => true,
  /** How far wheel and pinch zoom move per event; 1 is the default rate. */
  zoomSpeed: () => number = () => 1
) {
  const drag = ref<DragState | null>(null)
  // Canvas chrome that explains layout, such as auto layout child outlines, steps aside while
  // layers move, resize, or rotate.
  watch(
    () => drag.value?.type,
    (type) => editor.setTransforming(type === 'move' || type === 'resize' || type === 'rotate')
  )
  const canvasLabelEdit = createCanvasLabelEdit(editor)
  const cursorOverride = ref<string | null>(null)
  /** Whether the primary button is held on a preview control, such as a slider thumb. */
  const valueEdit = createAutoLayoutValueEdit(editor)
  const selectedIdsBeforeClickSequence = ref<ReadonlySet<string>>(new Set())
  const lastPointer = ref<{ cx: number; cy: number; sx: number; sy: number } | null>(null)
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

  /** ⌘ or Ctrl held: hover reaches the deepest layer, the one a click would select, as in Figma. */
  function hoverDeep(e?: MouseEvent) {
    return e ? e.metaKey || e.ctrlKey : metaHeld || controlHeld
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
      mode === 'deep' || hoverDeep()
    )
    editor.setAutoLayoutHover(autoLayoutHoverAt(pointer.cx, pointer.cy, mode))
    editor.setShapeHandleHover(shapeHandleHoverAt(pointer.sx, pointer.sy, altHeld))
  }

  // Handles that edit, which a read-only document does not offer.
  function autoLayoutHoverAt(cx: number, cy: number, mode: typeof editor.state.measurementMode) {
    return mode === 'off' && !editor.state.readOnly ? resolveAutoLayoutHover(cx, cy, editor) : null
  }

  function shapeHandleHoverAt(sx: number, sy: number, altKey: boolean) {
    return editor.state.readOnly ? null : resolveShapeHandleHover(editor, sx, sy, altKey)
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

  const guideInput = createGuideInput({
    canvasRef,
    editor,
    canvasToLocal,
    setDrag,
    setCursor: (cursor) => {
      cursorOverride.value = cursor
    }
  })

  const { handleTextEditClick, onDblClick: onTextDblClick } = createTextEditInput({
    editor,
    getCoords,
    hitTestInScope,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle,
    getClickCount,
    wasSelectedBeforeClickSequence: (id) => selectedIdsBeforeClickSequence.value.has(id),
    onEditCanvasLabel: canvasLabelEdit.start,
    setDrag
  })

  const {
    tryStartRotation,
    handlePanMove,
    handleRotateMove,
    handleTextSelectMove,
    handleMarqueeMove
  } = createCanvasTransformInput(editor, setDrag)

  function onDblClick(e: MouseEvent) {
    if (editor.state.play) return
    const { cx, cy } = getCoords(e)
    if (!editor.state.readOnly && valueEdit.start(cx, cy)) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onTextDblClick(e)
  }

  function onMouseDown(e: MouseEvent) {
    onActivate?.()
    if (!isEnabled()) return
    // Preview: controls live in islands above the canvas; the canvas itself only pans.
    if (editor.state.play && e.button === 0 && editor.state.activeTool !== 'HAND') {
      e.preventDefault()
      return
    }
    // Safari treats an unprevented press as the start of a text selection drag and freezes the
    // cursor until the pointer leaves the canvas; the canvas handles its own drags.
    if (e.button === 0) e.preventDefault()
    editor.setMeasurementMode('off')
    const openValueEdit = valueEdit.edit.value
    if (openValueEdit) valueEdit.commit(openValueEdit.value)
    if (!editor.state.editingTextId) canvasRef.value?.focus()
    editor.setHoveredNode(null)
    const { sx, sy, cx, cy } = getCoords(e)
    // Guides belong to the document, so a read-only one neither moves nor gains them.
    const guidesEditable = e.button === 0 && !editor.state.readOnly
    if (guidesEditable && guideInput.tryStartExisting(sx, sy, e.altKey)) {
      e.preventDefault()
      return
    }
    if (guidesEditable && guideInput.tryStartFromRuler(sx, sy, cx, cy)) {
      e.preventDefault()
      return
    }
    editor.setSelectedGuide(null)

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

  // Dispatching the full drag union is intentionally centralized here.
  // eslint-disable-next-line complexity
  function onMouseMove(e: MouseEvent) {
    if (!isEnabled()) return
    pointerInside.value = true
    const coords = getCoords(e)
    lastPointer.value = { cx: coords.cx, cy: coords.cy, sx: coords.sx, sy: coords.sy }
    if (onCursorMove) {
      onCursorMove(coords.cx, coords.cy)
    }

    if (editor.state.play && !drag.value) return

    if (!drag.value) {
      const { cx, cy } = coords
      updatePenHover(cx, cy, editor)
    }

    if (!drag.value) {
      const { cx, cy, sx, sy } = coords
      updateNodeEditHover(editor, cx, cy)
      editor.setShapeHandleHover(shapeHandleHoverAt(sx, sy, e.altKey))
    }

    if (!drag.value && editor.state.activeTool === 'CONNECTOR') {
      editor.connectorHover(coords.cx, coords.cy, attachModifiers(e))
    }

    if (!drag.value && editor.state.activeTool === 'SELECT') {
      const { sx, sy, cx, cy } = coords
      const guideCursor = editor.state.readOnly ? null : guideInput.updateHover(sx, sy)
      cursorOverride.value =
        guideCursor ??
        updateHoverCursor(
          cx,
          cy,
          editor,
          hitFns,
          editor.state.measurementMode === 'deep' || hoverDeep(e)
        )
      editor.setAutoLayoutHover(autoLayoutHoverAt(cx, cy, editor.state.measurementMode))
    }

    if (!drag.value) return
    const d = drag.value

    if (d.type === 'pan') {
      handlePanMove(d, e)
      return
    }

    const { sx, sy, cx, cy } = getCoords(e)

    if (d.type === 'gradient' || d.type === 'shape-handle') {
      d.update(sx, sy, e.shiftKey)
      return
    }

    if (d.type === 'guide') {
      const frameId = e.altKey && !d.guideId ? selectedTopLevelGuideFrameId(editor) : null
      guideInput.handleMove(
        d,
        sx,
        sy,
        cx,
        cy,
        frameId ? { frameId, deep: e.metaKey || e.ctrlKey } : undefined
      )
      return
    }

    if (d.type === 'rotate') {
      handleRotateMove(d, cx, cy, e.shiftKey)
      return
    }
    if (d.type === 'move') {
      handleMoveMove(d, cx, cy, sx, sy, editor, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })
      return
    }
    if (d.type === 'text-select') {
      handleTextSelectMove(cx, cy)
      return
    }
    if (d.type === 'resize') {
      applyResize(d, cx, cy, e.shiftKey, editor, e.ctrlKey)
      return
    }

    if (d.type === 'pen-drag') {
      handlePenDragMove(d, cx, cy, spaceHeld.value, e, editor)
      return
    }

    if (d.type === 'pencil-drag') {
      handlePencilDragMove(cx, cy, e.shiftKey, editor)
      return
    }

    if (d.type === 'edit-node' || d.type === 'edit-handle') {
      handleNodeEditMove(d, cx, cy, editor, e.altKey, e.metaKey || e.ctrlKey, e.shiftKey, e.ctrlKey)
      return
    }

    if (d.type === 'bend-handle') {
      handleBendHandleMove(d, cx, cy, e, editor)
      return
    }

    if (d.type === 'edit-marquee') {
      handleNodeEditMarqueeMove(d, cx, cy, editor)
      return
    }

    if (d.type === 'draw') {
      handleDrawMove(d, cx, cy, e.shiftKey)
      return
    }

    if (d.type === 'sticky-draw') {
      d.move(cx, cy)
      return
    }

    if (d.type === 'connector-draw') {
      handleConnectorDrawMove(d, cx, cy, sx, sy, editor, attachModifiers(e))
      return
    }

    if (d.type === 'connector-end') {
      editor.connectorEndpointDrag(cx, cy, attachModifiers(e))
      return
    }

    if (d.type === 'connector-line') {
      editor.connectorLineDrag(cx, cy)
      return
    }

    if (d.type === 'line-end') {
      editor.lineEndDrag(cx, cy, { shift: e.shiftKey, alt: e.altKey })
      return
    }

    if (d.type === 'sticky-scale') {
      applyStickyScale(d, cx, cy, editor)
      return
    }

    handleMarqueeMove(d, cx, cy)
  }

  function onMouseUp() {
    if (!drag.value) return
    const d = drag.value

    if (handleNodeEditPointerUp(drag, editor)) return

    if (d.type === 'guide') {
      guideInput.finish(d)
    } else if (d.type === 'move') handleMoveUp(d, editor)
    else if (d.type === 'text-select') {
      drag.value = null
      return
    } else if (d.type === 'resize') commitResizePreview(d, editor)
    else if (d.type === 'pen-drag') {
      const penState = editor.state.penState
      if (penState?.pendingClose) {
        editor.penCommit(true)
      }
      drag.value = null
      return
    } else if (d.type === 'pencil-drag') finishPencilDrag(editor)
    else if (d.type === 'rotate') {
      const preview = editor.state.rotationPreview
      if (preview?.nodeId === d.nodeId && preview.angle !== d.origRotation) {
        editor.updateNode(d.nodeId, { rotation: preview.angle })
        editor.commitRotation(d.nodeId, d.origRotation)
      }
      if (editor.state.rotationPreview === preview) editor.setRotationPreview(null)
    } else if ('commit' in d) d.commit()
    else if (d.type === 'marquee') finishMarquee(editor, d)

    drag.value = null
    cursorOverride.value = null
    refreshMeasurement()
  }

  function clearTransientInteractionFeedback() {
    editor.setSnapGuides([])
    editor.setLayoutInsertIndicator(null)
    editor.setDropTarget(null)
    editor.setShapeHandleHover(null)
    guideInput.clearHoverAndPreview()
  }

  /** Drops what a drag showed without changing the document. */
  function discardDrawnPreview(d: DragState) {
    if (d.type === 'resize') cancelResizePreview(d, editor)
    else if ('cancel' in d) d.cancel()
    else if (d.type === 'pencil-drag') editor.pencilCancel()
  }

  /** Takes back what a drag in progress has previewed, by its kind. */
  function discardDrag(d: DragState) {
    discardDrawnPreview(d)
    if (d.type === 'move') cancelMove(d, editor)
    else if (d.type === 'rotate') {
      if (editor.state.rotationPreview?.nodeId === d.nodeId) editor.setRotationPreview(null)
    } else cancelNodeEditDrag(d, editor)
  }

  function cancelPointerInteraction() {
    const d = drag.value
    // Cleared first: ending a preview fires events whose listeners cancel again.
    drag.value = null
    if (d) discardDrag(d)
    cursorOverride.value = null
    clearTransientInteractionFeedback()
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    canvasRef.value?.setPointerCapture(e.pointerId)
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    onMouseUp()
    if (canvasRef.value?.hasPointerCapture(e.pointerId)) {
      canvasRef.value.releasePointerCapture(e.pointerId)
    }
  }

  function onPointerCancel(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    cancelPointerInteraction()
    if (canvasRef.value?.hasPointerCapture(e.pointerId)) {
      canvasRef.value.releasePointerCapture(e.pointerId)
    }
  }

  useEventListener(canvasRef, 'pointerdown', onPointerDown)
  useEventListener(canvasRef, 'pointerup', onPointerUp)
  useEventListener(canvasRef, 'pointercancel', onPointerCancel)
  useEventListener(canvasRef, 'dblclick', onDblClick)
  useEventListener(canvasRef, 'mousedown', onMouseDown)
  useEventListener(canvasRef, 'mousemove', onMouseMove)
  useEventListener(canvasRef, 'mouseup', onMouseUp)
  useEventListener(window, 'keydown', (event) => {
    if (guideInput.deleteSelected(event)) return
    updateModifier(event.code, true)
    refreshConnectorDrag(drag.value, lastPointer.value, event, editor)
  })
  useEventListener(window, 'keyup', (event) => {
    updateModifier(event.code, false)
    refreshConnectorDrag(drag.value, lastPointer.value, event, editor)
  })
  useEventListener(
    window,
    'keydown',
    (event) => {
      if (event.code !== 'Escape' || event.isComposing || !isEnabled()) return
      const type = drag.value?.type
      // A vector edit marquee carries on through Escape, as in Figma, and keeps the path open.
      const swallowed = type === 'edit-marquee'
      if (!type || (!ESCAPABLE_DRAGS.has(type) && !swallowed)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!swallowed) cancelPointerInteraction()
    },
    { capture: true }
  )
  // Space during a move keeps layers in their parents, as in Figma, instead of switching to the hand.
  function holdParentsDuringMove(event: KeyboardEvent, held: boolean) {
    if (event.code !== 'Space' || drag.value?.type !== 'move' || !isEnabled()) return
    event.preventDefault()
    event.stopImmediatePropagation()
    drag.value.keepParents = held
    if (held) editor.setDropTarget(null)
  }
  useEventListener(window, 'keydown', (event) => holdParentsDuringMove(event, true), {
    capture: true
  })
  useEventListener(window, 'keyup', (event) => holdParentsDuringMove(event, false), {
    capture: true
  })
  useEventListener(window, 'blur', () => {
    resetMeasurementModifiers()
    cancelPointerInteraction()
  })
  useEventListener(canvasRef, 'mouseleave', () => {
    pointerInside.value = false
    if (!isEnabled()) return
    editor.setMeasurementMode('off')
    if (!drag.value) {
      editor.setHoveredNode(null)
      editor.setHoveredGuide(null)
      editor.setShapeHandleHover(null)
    }
  })
  useEventListener(
    window,
    'mouseup',
    () => {
      if (drag.value) onMouseUp()
    },
    { capture: true }
  )

  const stopRotationListener = editor.onEditorEvent('rotation:preview-changed', (preview) => {
    if (drag.value?.type === 'rotate' && preview?.nodeId !== drag.value.nodeId)
      cancelPointerInteraction()
  })
  const stopToolListener = editor.onEditorEvent('tool:changed', () => {
    if (!isEnabled()) return
    editor.setMeasurementMode('off')
    cancelPointerInteraction()
  })
  // A document that turns read-only mid-gesture drops the gesture and any open inline edit.
  const stopReadOnlyListener = editor.onEditorEvent('document:read-only-changed', (readOnly) => {
    if (!readOnly) return
    valueEdit.cancel()
    canvasLabelEdit.cancel()
    cancelPointerInteraction()
  })
  const stopPlayListeners = (['selection:changed', 'page:changed', 'graph:replaced'] as const).map(
    (event) =>
      editor.onEditorEvent(event, () => {
        const type = drag.value?.type
        if (
          type === 'draw' ||
          type === 'sticky-draw' ||
          type === 'rotate' ||
          type === 'shape-handle' ||
          type === 'sticky-scale'
        )
          cancelPointerInteraction()
      })
  )
  onScopeDispose(() => {
    stopRotationListener()
    stopToolListener()
    stopReadOnlyListener()
    for (const stop of stopPlayListeners) stop()
    cancelPointerInteraction()
  })

  setupPanZoom(canvasRef, editor, drag, onMouseDown, onMouseMove, onMouseUp, zoomSpeed)
  return {
    drag,
    cursorOverride,
    canvasLabelEdit: canvasLabelEdit.edit,
    updateCanvasLabelEdit: canvasLabelEdit.update,
    commitCanvasLabelEdit: canvasLabelEdit.commit,
    cancelCanvasLabelEdit: canvasLabelEdit.cancel,
    autoLayoutValueEdit: valueEdit.edit,
    updateAutoLayoutValueEdit: valueEdit.update,
    commitAutoLayoutValueEdit: valueEdit.commit,
    cancelAutoLayoutValueEdit: valueEdit.cancel,
    cleanupInteractions() {
      valueEdit.cancel()
      cancelPointerInteraction()
      pointerInside.value = false
      resetMeasurementModifiers()
    }
  }
}
