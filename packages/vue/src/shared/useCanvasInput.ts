import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import {
  PEN_CLOSE_THRESHOLD,
  ROTATION_SNAP_DEGREES,
  DEFAULT_TEXT_WIDTH,
  DEFAULT_TEXT_HEIGHT,
  degToRad
} from '@open-pencil/core'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core'

import type { DragMarquee, DragPan, DragRotate, DragState } from './input/types'
import { TOOL_TO_NODE } from './input/types'
import { hitTestCornerRotation } from './input/geometry'
import { setupPanZoom } from './input/pan-zoom'
import { applyResize } from './input/resize'
import { handleMoveMove, handleMoveUp } from './input/move'
import { handleSelectDown, updateHoverCursor, type HitTestFns } from './input/select'
import { handleDrawMove, handleDrawUp } from './input/draw'

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
  let lastClickTime = 0
  let lastClickX = 0
  let lastClickY = 0
  let clickCount = 0
  const MULTI_CLICK_DELAY = 500
  const MULTI_CLICK_RADIUS = 5

  function getCoords(e: MouseEvent) {
    const canvas = canvasRef.value
    if (!canvas) return { sx: 0, sy: 0, cx: 0, cy: 0 }
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x: cx, y: cy } = editor.screenToCanvas(sx, sy)
    return { sx, sy, cx, cy }
  }

  function canvasToLocal(cx: number, cy: number, scopeId: string): { lx: number; ly: number } {
    const node = editor.graph.getNode(scopeId)
    if (!node) return { lx: cx, ly: cy }
    const abs = editor.graph.getAbsolutePosition(scopeId)
    let dx = cx - abs.x
    let dy = cy - abs.y
    if (node.rotation !== 0) {
      const hw = node.width / 2
      const hh = node.height / 2
      const rad = degToRad(-node.rotation)
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const rx = dx - hw
      const ry = dy - hh
      dx = rx * cos - ry * sin + hw
      dy = rx * sin + ry * cos + hh
    }
    return { lx: dx, ly: dy }
  }

  function hitTestInScope(cx: number, cy: number, deep: boolean): SceneNode | null {
    const scopeId = editor.state.enteredContainerId
    if (scopeId) {
      if (!editor.graph.getNode(scopeId)) {
        editor.state.enteredContainerId = null
      } else {
        const { lx, ly } = canvasToLocal(cx, cy, scopeId)
        return deep
          ? editor.graph.hitTestDeep(lx, ly, scopeId)
          : editor.graph.hitTest(lx, ly, scopeId)
      }
    }
    return deep
      ? editor.graph.hitTestDeep(cx, cy, editor.state.currentPageId)
      : editor.graph.hitTest(cx, cy, editor.state.currentPageId)
  }

  function isInsideContainerBounds(cx: number, cy: number, containerId: string): boolean {
    const container = editor.graph.getNode(containerId)
    if (!container) return false
    const { lx, ly } = canvasToLocal(cx, cy, containerId)
    return lx >= 0 && lx <= container.width && ly >= 0 && ly <= container.height
  }

  const hitFns: HitTestFns = {
    hitTestInScope,
    isInsideContainerBounds,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle
  }

  function setDrag(d: DragState) {
    drag.value = d
  }

  function startPanDrag(e: MouseEvent) {
    drag.value = {
      type: 'pan',
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startPanX: editor.state.panX,
      startPanY: editor.state.panY
    }
  }

  function handleTextEditClick(cx: number, cy: number, shiftKey: boolean): boolean {
    const textEd = editor.textEditor
    const editNode = editor.state.editingTextId
      ? editor.graph.getNode(editor.state.editingTextId)
      : null
    if (!textEd || !editNode) {
      editor.commitTextEdit()
      return false
    }
    const abs = editor.graph.getAbsolutePosition(editNode.id)
    const localX = cx - abs.x
    const localY = cy - abs.y
    if (localX < 0 || localY < 0 || localX > editNode.width || localY > editNode.height) {
      editor.commitTextEdit()
      return false
    }
    if (clickCount >= 3) {
      textEd.selectAll()
    } else if (clickCount === 2) {
      textEd.selectWordAt(localX, localY)
    } else {
      textEd.setCursorAt(localX, localY, shiftKey)
      drag.value = { type: 'text-select', startX: cx, startY: cy } as DragState
    }
    editor.requestRender()
    return true
  }

  function tryStartRotation(sx: number, sy: number): boolean {
    if (editor.state.selectedIds.size !== 1) return false
    const id = [...editor.state.selectedIds][0]
    const node = editor.graph.getNode(id)
    if (!node || node.locked) return false
    const abs = editor.graph.getAbsolutePosition(id)
    if (
      !hitTestCornerRotation(
        sx,
        sy,
        abs.x,
        abs.y,
        node.width,
        node.height,
        editor.state.zoom,
        editor.state.panX,
        editor.state.panY,
        node.rotation
      )
    )
      return false

    const screenCx = (abs.x + node.width / 2) * editor.state.zoom + editor.state.panX
    const screenCy = (abs.y + node.height / 2) * editor.state.zoom + editor.state.panY
    const startAngle = Math.atan2(sy - screenCy, sx - screenCx) * (180 / Math.PI)
    drag.value = {
      type: 'rotate',
      nodeId: id,
      centerX: screenCx,
      centerY: screenCy,
      startAngle,
      origRotation: node.rotation
    }
    return true
  }

  function handlePanMove(d: DragPan, e: MouseEvent) {
    const dx = e.clientX - d.startScreenX
    const dy = e.clientY - d.startScreenY
    editor.state.panX = d.startPanX + dx
    editor.state.panY = d.startPanY + dy
    editor.requestRepaint()
  }

  function handleRotateMove(d: DragRotate, sx: number, sy: number, shiftKey: boolean) {
    const currentAngle = Math.atan2(sy - d.centerY, sx - d.centerX) * (180 / Math.PI)
    let rotation = d.origRotation + (currentAngle - d.startAngle)

    if (shiftKey) {
      rotation = Math.round(rotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES
    }

    rotation = ((((rotation + 180) % 360) + 360) % 360) - 180
    editor.setRotationPreview({ nodeId: d.nodeId, angle: rotation })
  }

  function handleTextSelectMove(cx: number, cy: number) {
    const textEd = editor.textEditor
    const editNode = editor.state.editingTextId
      ? editor.graph.getNode(editor.state.editingTextId)
      : null
    if (textEd && editNode) {
      const abs = editor.graph.getAbsolutePosition(editNode.id)
      textEd.setCursorAt(cx - abs.x, cy - abs.y, true)
      editor.requestRender()
    }
  }

  function handleMarqueeMove(d: DragMarquee, cx: number, cy: number) {
    const minX = Math.min(d.startX, cx)
    const minY = Math.min(d.startY, cy)
    const maxX = Math.max(d.startX, cx)
    const maxY = Math.max(d.startY, cy)

    const scopeId = editor.state.enteredContainerId
    const parentId = scopeId ?? editor.state.currentPageId
    const localMin = scopeId ? canvasToLocal(minX, minY, scopeId) : { lx: minX, ly: minY }
    const localMax = scopeId ? canvasToLocal(maxX, maxY, scopeId) : { lx: maxX, ly: maxY }
    const localMinX = Math.min(localMin.lx, localMax.lx)
    const localMinY = Math.min(localMin.ly, localMax.ly)
    const localMaxX = Math.max(localMin.lx, localMax.lx)
    const localMaxY = Math.max(localMin.ly, localMax.ly)

    const hits: string[] = []
    for (const node of editor.graph.getChildren(parentId)) {
      if (!node.visible || node.locked) continue
      if (
        node.x + node.width > localMinX &&
        node.x < localMaxX &&
        node.y + node.height > localMinY &&
        node.y < localMaxY
      ) {
        hits.push(node.id)
      }
    }
    editor.select(hits)
    editor.setMarquee({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
  }

  function onMouseDown(e: MouseEvent) {
    editor.setHoveredNode(null)
    const { sx, sy, cx, cy } = getCoords(e)

    const now = performance.now()
    if (
      now - lastClickTime < MULTI_CLICK_DELAY &&
      Math.abs(sx - lastClickX) < MULTI_CLICK_RADIUS &&
      Math.abs(sy - lastClickY) < MULTI_CLICK_RADIUS
    ) {
      clickCount++
    } else {
      clickCount = 1
    }
    lastClickTime = now
    lastClickX = sx
    lastClickY = sy
    const tool = editor.state.activeTool

    if (e.button === 1 || tool === 'HAND') {
      startPanDrag(e)
      return
    }

    if (tool === 'SELECT' && e.altKey && !editor.state.selectedIds.size) {
      startPanDrag(e)
      return
    }

    if (tool === 'SELECT') {
      handleSelectDown(
        e, sx, sy, cx, cy, editor, hitFns,
        tryStartRotation, handleTextEditClick, setDrag
      )
      return
    }

    if (tool === 'PEN') {
      editor.penAddVertex(cx, cy)
      drag.value = { type: 'pen-drag', startX: cx, startY: cy } as DragState
      return
    }

    if (tool === 'TEXT') {
      const nodeId = editor.createShape('TEXT', cx, cy, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT)
      editor.graph.updateNode(nodeId, { text: '' })
      editor.select([nodeId])
      editor.startTextEditing(nodeId)
      editor.setTool('SELECT')
      editor.requestRender()
      return
    }

    const nodeType = TOOL_TO_NODE[tool]
    if (!nodeType) return

    const nodeId = editor.createShape(nodeType, cx, cy, 0, 0)
    editor.select([nodeId])

    drag.value = { type: 'draw', startX: cx, startY: cy, nodeId }
  }

  function onMouseMove(e: MouseEvent) {
    if (onCursorMove) {
      const { cx, cy } = getCoords(e)
      onCursorMove(cx, cy)
    }

    if (editor.state.activeTool === 'PEN' && editor.state.penState && !drag.value) {
      const { cx, cy } = getCoords(e)
      editor.state.penCursorX = cx
      editor.state.penCursorY = cy

      const first = editor.state.penState.vertices[0]
      if (editor.state.penState.vertices.length > 2) {
        const dist = Math.hypot(cx - first.x, cy - first.y)
        editor.penSetClosingToFirst(dist < PEN_CLOSE_THRESHOLD)
      }
      editor.requestRepaint()
    }

    if (!drag.value && editor.state.activeTool === 'SELECT') {
      const { sx, sy, cx, cy } = getCoords(e)
      cursorOverride.value = updateHoverCursor(sx, sy, cx, cy, editor, hitFns)
    }

    if (!drag.value) return
    const d = drag.value

    if (d.type === 'pan') {
      handlePanMove(d, e)
      return
    }

    const { cx, cy, sx, sy } = getCoords(e)

    if (d.type === 'rotate') {
      handleRotateMove(d, sx, sy, e.shiftKey)
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
      const tx = cx - d.startX
      const ty = cy - d.startY
      if (Math.hypot(tx, ty) > 2) {
        editor.penSetDragTangent(tx, ty)
      }
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

    if (d.type === 'move') handleMoveUp(d, editor)
    else if (d.type === 'text-select') {
      drag.value = null
      return
    } else if (d.type === 'resize') editor.commitResize(d.nodeId, d.origRect)
    else if (d.type === 'pen-drag') {
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

  function onDblClick(e: MouseEvent) {
    if (editor.state.editingTextId) return

    const { cx, cy } = getCoords(e)

    const selectedId =
      editor.state.selectedIds.size === 1 ? [...editor.state.selectedIds][0] : undefined
    const selectedNode = selectedId ? editor.graph.getNode(selectedId) : undefined
    const canEnter =
      selectedNode && selectedId && editor.graph.isContainer(selectedId) && !selectedNode.locked

    if (canEnter) {
      editor.enterContainer(selectedId)
      const useDeep = selectedNode.type === 'COMPONENT' || selectedNode.type === 'INSTANCE'
      const hit = hitTestInScope(cx, cy, useDeep)
      if (hit) {
        editor.select([hit.id])
      } else {
        editor.clearSelection()
      }
      return
    }

    const hit =
      hitTestSectionTitle(cx, cy) ?? hitTestComponentLabel(cx, cy) ?? hitTestInScope(cx, cy, true)
    if (!hit) return

    if (hit.type === 'TEXT') {
      editor.select([hit.id])
      editor.startTextEditing(hit.id)
      const textEd = editor.textEditor
      if (textEd) {
        const abs = editor.graph.getAbsolutePosition(hit.id)
        textEd.selectWordAt(cx - abs.x, cy - abs.y)
        editor.requestRender()
      }
      return
    }

    editor.select([hit.id])
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
    cursorOverride
  }
}
