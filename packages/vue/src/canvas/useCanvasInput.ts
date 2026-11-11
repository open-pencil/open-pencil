import { useEventListener } from '@vueuse/core'
import { onScopeDispose, ref, watch, type Ref } from 'vue'

import { resolveEditorProfile, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { createAutoLayoutValueEdit } from '#vue/canvas/auto-layout/value-edit'
import { createGuideInput } from '#vue/canvas/guides/input'
import { createCanvasLabelEdit } from '#vue/canvas/labels/edit'
import { finishPencilDrag } from '#vue/canvas/pencil/input'
import {
  discardCanvasDrag,
  ESCAPABLE_DRAGS,
  moveCanvasDrag,
  SELECTION_BOUND_DRAGS,
  TRANSFORMING_DRAGS,
  type CanvasDragMoveContext
} from '#vue/canvas/pointer/drag'
import { createCanvasPointer } from '#vue/canvas/pointer/use'
import { createTextEditInput } from '#vue/canvas/text-edit/input'
import { hoverCanvasTool, pressCanvasTool } from '#vue/canvas/tools/input'
import type { CanvasToolContext, CanvasToolPointer } from '#vue/canvas/tools/registry'
import { createCanvasTransformInput } from '#vue/canvas/transform/input'
import { finishMarquee } from '#vue/canvas/transform/marquee'
import { commitRotationDrag } from '#vue/canvas/transform/rotation'
import { handleNodeEditPointerUp, updateNodeEditHover } from '#vue/canvas/vector-input/input'
import { resolveAutoLayoutHover } from '#vue/shared/input/auto-layout-hover'
import { createClickCounter } from '#vue/shared/input/click-count'
import { refreshConnectorDrag } from '#vue/shared/input/connector/draw'
import { handleMoveUp } from '#vue/shared/input/move/drag'
import { setupPanZoom } from '#vue/shared/input/pan/zoom'
import { commitResizePreview } from '#vue/shared/input/resize'
import { commitSelectionResize } from '#vue/shared/input/resize/selection'
import { updateHoverCursor } from '#vue/shared/input/select'
import { resolveShapeHandleHover } from '#vue/shared/input/shape-handles'
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
  isEnabled: () => boolean = () => true,
  /** How far wheel and pinch zoom move per event; 1 is the default rate. */
  zoomSpeed: () => number = () => 1
) {
  const drag = ref<DragState | null>(null)
  const profile = () => resolveEditorProfile(editor.state)
  /** Whether layers may change: not in a read-only document, nor while the host keeps them. */
  const editsLayers = () => profile().layerEdits === 'all'
  // Canvas chrome that explains layout, such as auto layout child outlines, steps aside while
  // layers move, resize, or rotate.
  watch(
    () => drag.value?.type,
    (type) => editor.setTransforming(type !== undefined && TRANSFORMING_DRAGS.has(type))
  )
  const canvasLabelEdit = createCanvasLabelEdit(editor)
  const cursorOverride = ref<string | null>(null)
  /** Whether the primary button is held on a preview control, such as a slider thumb. */
  const valueEdit = createAutoLayoutValueEdit(editor)
  const lastPointer = ref<{ cx: number; cy: number; sx: number; sy: number } | null>(null)
  const pointerInside = ref(false)
  let altHeld = false
  let metaHeld = false
  let controlHeld = false
  const spaceHeld = useSpaceHeld()
  const { recordClick, getClickCount } = createClickCounter()

  const { getCoords, canvasToLocal, hitTestLayer, hitFns } = createCanvasPointer(
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
    return mode === 'off' && editsLayers() ? resolveAutoLayoutHover(cx, cy, editor) : null
  }

  function shapeHandleHoverAt(sx: number, sy: number, altKey: boolean) {
    return editsLayers() ? resolveShapeHandleHover(editor, sx, sy, altKey) : null
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

  const { handleTextEditClick, pressDeeper } = createTextEditInput({
    editor,
    getCoords,
    hitTestLayer,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle,
    getClickCount,
    onEditCanvasLabel: canvasLabelEdit.start,
    setDrag
  })

  const transform = createCanvasTransformInput(editor, setDrag)
  const { tryStartRotation } = transform
  const dragMoveContext: CanvasDragMoveContext = {
    editor,
    guideInput,
    transform,
    spaceHeld: () => spaceHeld.value
  }

  /**
   * Only a plain press of the select tool takes a double-click on its press: a drawing tool, a
   * vector being edited, and a Shift-press that adds to the selection keep their own press.
   */
  function takesMultiClick(e: MouseEvent): boolean {
    return (
      e.button === 0 &&
      !e.shiftKey &&
      editor.state.activeTool === 'SELECT' &&
      !editor.state.editingTextId &&
      !editor.state.nodeEditState &&
      profile().pointer !== 'pan'
    )
  }

  /**
   * The second click of a run and every one after it, on its press: one level deeper, or a value
   * field, as in Figma. The press decides so that every click of a quick run counts; the browser
   * fires its double-click event by its own count, which a click shortly before the run shifts.
   */
  function onMultiClickDown(e: MouseEvent, clickCount: number) {
    const { cx, cy } = getCoords(e)
    if (clickCount === 2 && editsLayers() && valueEdit.start(cx, cy)) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    pressDeeper(e, clickCount > 2)
  }

  function onDblClick(e: MouseEvent) {
    // Handled on the press; the event only must not start a browser text selection.
    e.preventDefault()
  }

  function hoverLayers({ event, cx, cy, sx, sy }: CanvasToolPointer) {
    const guideCursor = editsLayers() ? guideInput.updateHover(sx, sy) : null
    cursorOverride.value =
      guideCursor ??
      (editor.state.activeTool === 'SCALE'
        ? null
        : updateHoverCursor(
            cx,
            cy,
            editor,
            hitFns,
            editor.state.measurementMode === 'deep' || hoverDeep(event)
          ))
    editor.setAutoLayoutHover(autoLayoutHoverAt(cx, cy, editor.state.measurementMode))
  }

  const toolContext: CanvasToolContext = {
    editor,
    hitFns,
    cursorOverride,
    setDrag,
    tryStartRotation,
    handleTextEditClick,
    hoverLayers
  }

  function onMouseDown(e: MouseEvent) {
    onActivate?.()
    if (!isEnabled()) return
    // A canvas that only pans, as a preview's does, leaves its controls to the islands above it.
    const panOnly = profile().pointer === 'pan'
    if (panOnly && e.button === 0 && editor.state.activeTool !== 'HAND') {
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
    const guidesEditable = e.button === 0 && editsLayers()
    if (guidesEditable && guideInput.tryStartExisting(sx, sy, e.altKey)) {
      e.preventDefault()
      return
    }
    if (guidesEditable && guideInput.tryStartFromRuler(sx, sy, cx, cy)) {
      e.preventDefault()
      return
    }
    editor.setSelectedGuide(null)

    const clickCount = recordClick(sx, sy, e.detail)
    if (clickCount >= 2 && takesMultiClick(e)) {
      onMultiClickDown(e, clickCount)
      return
    }
    pressCanvasTool({ event: e, cx, cy, sx, sy }, toolContext)
  }

  function onMouseMove(e: MouseEvent) {
    if (!isEnabled()) return
    pointerInside.value = true
    const coords = getCoords(e)
    lastPointer.value = { cx: coords.cx, cy: coords.cy, sx: coords.sx, sy: coords.sy }
    if (onCursorMove) {
      onCursorMove(coords.cx, coords.cy)
    }

    if (profile().pointer === 'pan' && !drag.value) return

    if (!drag.value) {
      const { cx, cy, sx, sy } = coords
      updateNodeEditHover(editor, cx, cy)
      editor.setShapeHandleHover(shapeHandleHoverAt(sx, sy, e.altKey))
      hoverCanvasTool({ event: e, ...coords }, toolContext)
    }

    if (drag.value) moveCanvasDrag(drag.value, e, coords, dragMoveContext)
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
    else if (d.type === 'resize-selection') commitSelectionResize(d, editor)
    else if (d.type === 'pen-drag') {
      // Cleared first: a host that refuses the release cancels the gesture, which drops the drag.
      drag.value = null
      editor.penRelease()
      return
    } else if (d.type === 'pencil-drag') finishPencilDrag(editor)
    else if (d.type === 'rotate' || d.type === 'rotate-selection') commitRotationDrag(editor, d)
    else if ('commit' in d) d.commit()
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

  function cancelPointerInteraction() {
    const d = drag.value
    // Cleared first: ending a preview fires events whose listeners cancel again.
    drag.value = null
    if (d) discardCanvasDrag(d, editor)
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
    // Where layers only move, they stay in their parents whatever the key.
    drag.value.keepParents = held || profile().layerEdits === 'move'
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

  // A host that refused the gesture in progress (`cancelGesture`): the drag is undone as Escape
  // undoes it, its preview put back.
  const stopGestureListener = editor.onEditorEvent('gesture:cancelled', cancelPointerInteraction)
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
  /** Abandons the gestures that change layers once layers may no longer change. */
  function cancelLayerEdits() {
    valueEdit.cancel()
    canvasLabelEdit.cancel()
    cancelPointerInteraction()
  }
  const stopReadOnlyListener = editor.onEditorEvent('document:read-only-changed', (readOnly) => {
    if (readOnly) cancelLayerEdits()
  })
  const stopRestrictionsListener = editor.onEditorEvent('document:restrictions-changed', () => {
    if (!editsLayers()) cancelLayerEdits()
  })
  const stopPlayListeners = (['selection:changed', 'page:changed', 'graph:replaced'] as const).map(
    (event) =>
      editor.onEditorEvent(event, () => {
        const type = drag.value?.type
        if (type && SELECTION_BOUND_DRAGS.has(type)) cancelPointerInteraction()
      })
  )
  onScopeDispose(() => {
    stopGestureListener()
    stopRotationListener()
    stopToolListener()
    stopReadOnlyListener()
    stopRestrictionsListener()
    for (const stop of stopPlayListeners) stop()
    cancelPointerInteraction()
    // A canvas unmounted mid-rename keeps the name typed, as the field's blur does in Chromium.
    canvasLabelEdit.commit()
  })

  setupPanZoom(canvasRef, editor, drag, onMouseDown, onMouseMove, onMouseUp, zoomSpeed)
  return {
    drag,
    cursorOverride,
    canvasLabelEdit: canvasLabelEdit.edit,
    startCanvasLabelEdit: canvasLabelEdit.start,
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
