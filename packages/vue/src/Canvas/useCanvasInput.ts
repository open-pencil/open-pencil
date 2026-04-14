import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import {
  PEN_CLOSE_THRESHOLD,
  ROTATION_SNAP_DEGREES,
  DEFAULT_TEXT_WIDTH,
  DEFAULT_TEXT_HEIGHT,
  degToRad
} from '@open-pencil/core'
import { getAbsolutePositionFull } from '@open-pencil/core/canvas/coordinate'
import { handleDrawMove, handleDrawUp } from '@open-pencil/vue/shared/input/draw'
import { hitTestCornerRotationByMatrix } from '@open-pencil/vue/shared/input/geometry'
import { handleMoveMove, handleMoveUp } from '@open-pencil/vue/shared/input/move'
import { setupPanZoom } from '@open-pencil/vue/shared/input/pan-zoom'
import { applyResize } from '@open-pencil/vue/shared/input/resize'
import {
  handlePenNodeEditDown,
  handleNodeEditMove,
  handleSelectDown,
  updateHoverCursor,
  hitTestEditHandle,
  isEndpoint,
  NODE_HIT_THRESHOLD,
  type HitTestFns
} from '@open-pencil/vue/shared/input/select'
import { TOOL_TO_NODE } from '@open-pencil/vue/shared/input/types'

import type { SceneNode, Vector, VectorSegment } from '@open-pencil/core'
import type { Editor } from '@open-pencil/core/editor'
import type {
  DragMarquee,
  DragPan,
  DragRotate,
  DragState
} from '@open-pencil/vue/shared/input/types'

type NodeEditState = {
  segments: VectorSegment[]
  vertices: Vector[]
  hoveredHandleInfo: {
    segmentIndex: number
    tangentField: 'tangentStart' | 'tangentEnd'
  } | null
}

type NodeEditMethods = Partial<{
  nodeEditBendHandle: (
    vertexIndex: number,
    dx: number,
    dy: number,
    independent: boolean,
    targetSegmentIndex: number | null,
    targetTangentField: 'tangentStart' | 'tangentEnd' | null
  ) => void
  nodeEditZeroVertexHandles: (vertexIndex: number) => void
  nodeEditConnectEndpoints: (a: number, b: number) => void
  enterNodeEditMode: (nodeId: string) => void
}>

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
  const spaceHeld = ref(false)
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space') spaceHeld.value = true
  })
  useEventListener(window, 'keyup', (e: KeyboardEvent) => {
    if (e.code === 'Space') spaceHeld.value = false
  })
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

    const renderer = editor.renderer
    if (!renderer) return null
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

  function tryStartRotation(cx: number, cy: number): boolean {
    if (editor.state.selectedIds.size !== 1) return false
    const id = [...editor.state.selectedIds][0]
    const node = editor.graph.getNode(id)
    if (!node || node.locked) return false

    if (editor.state.selectedIds.size > 1) {
      return false
    }
    const abs = getAbsolutePositionFull(node, editor.graph)

    if (!hitTestCornerRotationByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom!)) {
      return false
    }
    const startAngle = Math.atan2(cy - abs.centerY, cx - abs.centerX) * (180 / Math.PI)
    drag.value = {
      type: 'rotate',
      nodeId: id,
      centerX: abs.centerX,
      centerY: abs.centerY,
      startAngle: startAngle,
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

    let delta = currentAngle - d.startAngle

    delta = ((((delta + 180) % 360) + 360) % 360) - 180
    let rotation = d.origRotation + delta

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

  function resolveBendTargetHandle(
    es: NodeEditState | null | undefined,
    vertexIndex: number,
    samples: Vector[]
  ): { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' } | null {
    if (!es || samples.length === 0) return null
    const vx = es.vertices[vertexIndex]?.x
    const vy = es.vertices[vertexIndex]?.y
    if (vx == null || vy == null) return null

    const sampleVector = samples.reduce(
      (acc, p) => ({ x: acc.x + (p.x - vx), y: acc.y + (p.y - vy) }),
      { x: 0, y: 0 }
    )
    const sampleLen = Math.hypot(sampleVector.x, sampleVector.y)
    if (sampleLen < 1e-6) return null
    const sampleDir = { x: sampleVector.x / sampleLen, y: sampleVector.y / sampleLen }

    let best: { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' } | null = null
    let bestDot = -Infinity
    for (let i = 0; i < es.segments.length; i++) {
      const seg = es.segments[i]
      let tangentField: 'tangentStart' | 'tangentEnd'
      let neighborIndex: number
      let tangent: Vector
      if (seg.start === vertexIndex) {
        tangentField = 'tangentStart'
        neighborIndex = seg.end
        tangent = seg.tangentStart
      } else if (seg.end === vertexIndex) {
        tangentField = 'tangentEnd'
        neighborIndex = seg.start
        tangent = seg.tangentEnd
      } else {
        continue
      }

      const neighbor = es.vertices[neighborIndex]
      if (!neighbor) continue

      const tangentLen = Math.hypot(tangent.x, tangent.y)
      const base =
        tangentLen > 1e-6
          ? tangent
          : {
              x: neighbor.x - vx,
              y: neighbor.y - vy
            }
      const baseLen = Math.hypot(base.x, base.y)
      if (baseLen < 1e-6) continue
      const dir = { x: base.x / baseLen, y: base.y / baseLen }
      const dot = dir.x * sampleDir.x + dir.y * sampleDir.y
      if (dot > bestDot) {
        bestDot = dot
        best = { segmentIndex: i, tangentField }
      }
    }
    return best
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

    if (tool === 'SELECT') {
      handleSelectDown(e, cx, cy, editor, hitFns, tryStartRotation, handleTextEditClick, setDrag)
      return
    }

    if (tool === 'PEN') {
      // Hide draft segment during drag
      editor.state.penCursorX = null
      editor.state.penCursorY = null

      // In node edit mode with pen tool: click curve to add point, click vertex to remove
      const nodeEditState = (
        editor.state as Editor['state'] & { nodeEditState?: NodeEditState | null }
      ).nodeEditState
      if (nodeEditState) {
        handlePenNodeEditDown(e, cx, cy, editor)
        return
      }

      const penState = editor.state.penState
      if (penState && penState.vertices.length > 2) {
        const first = penState.vertices[0]
        const dist = Math.hypot(cx - first.x, cy - first.y)
        if (dist < PEN_CLOSE_THRESHOLD) {
          editor.penSetPendingClose(true)
          editor.penSetClosingToFirst(true)
          drag.value = {
            type: 'pen-drag',
            startX: first.x,
            startY: first.y,
            modifierMode: 'default',
            frozenOppositeTangent: null,
            spaceDown: false,
            spaceStartX: 0,
            spaceStartY: 0,
            knotStartX: first.x,
            knotStartY: first.y
          } as DragState
          cursorOverride.value = 'crosshair'
          return
        }
      }

      editor.penSetPendingClose(false)
      editor.penAddVertex(cx, cy)
      drag.value = {
        type: 'pen-drag',
        startX: cx,
        startY: cy,
        modifierMode: 'default',
        frozenOppositeTangent: null,
        spaceDown: false,
        spaceStartX: 0,
        spaceStartY: 0,
        knotStartX: cx,
        knotStartY: cy
      } as DragState
      cursorOverride.value = 'crosshair'
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

    editor.undo.beginBatch('Create shape')
    const nodeId = editor.createShape(nodeType, cx, cy, 0, 0)
    editor.select([nodeId])

    drag.value = { type: 'draw', startX: cx, startY: cy, nodeId }
  }

  function onMouseMove(e: MouseEvent) {
    const nodeEditEditor = editor as Editor & NodeEditMethods
    if (onCursorMove) {
      const { cx, cy } = getCoords(e)
      onCursorMove(cx, cy)
    }

    if (editor.state.activeTool === 'PEN' && editor.state.penState && !drag.value) {
      const { cx, cy } = getCoords(e)
      editor.state.penCursorX = cx
      editor.state.penCursorY = cy

      if (!drag.value) {
        const first = editor.state.penState.vertices[0]
        if (editor.state.penState.vertices.length > 2) {
          const dist = Math.hypot(cx - first.x, cy - first.y)
          editor.penSetClosingToFirst(dist < PEN_CLOSE_THRESHOLD)
        }
      }
      editor.requestRepaint()
    }

    // Track hovered handle in node edit mode
    const nodeEditState = (
      editor.state as Editor['state'] & { nodeEditState?: NodeEditState | null }
    ).nodeEditState
    if (!drag.value && nodeEditState) {
      const { cx, cy } = getCoords(e)
      const hit = hitTestEditHandle(editor, cx, cy)
      const es = nodeEditState
      const prev = es.hoveredHandleInfo
      if (hit) {
        if (
          !prev ||
          prev.segmentIndex !== hit.segmentIndex ||
          prev.tangentField !== hit.tangentField
        ) {
          es.hoveredHandleInfo = { segmentIndex: hit.segmentIndex, tangentField: hit.tangentField }
          editor.requestRepaint()
        }
      } else if (prev) {
        es.hoveredHandleInfo = null
        editor.requestRepaint()
      }
    }

    if (!drag.value && editor.state.activeTool === 'SELECT') {
      const { cx, cy } = getCoords(e)
      cursorOverride.value = updateHoverCursor(cx, cy, editor, hitFns)
    }

    if (!drag.value) return
    const d = drag.value

    if (d.type === 'pan') {
      handlePanMove(d, e)
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
      const isSpace = spaceHeld.value
      const penState = editor.state.penState

      if (!penState) return
      const isClosing = !!penState.pendingClose && penState.vertices.length > 2
      const anchorIndex = isClosing ? 0 : penState.vertices.length - 1
      const anchor = penState.vertices[anchorIndex]

      if (isSpace) {
        if (!d.spaceDown) {
          d.spaceDown = true
          d.spaceStartX = cx
          d.spaceStartY = cy
          d.knotStartX = anchor.x
          d.knotStartY = anchor.y
        }

        const dx = cx - d.spaceStartX
        const dy = cy - d.spaceStartY
        editor.penSetKnotPosition?.(d.knotStartX + dx, d.knotStartY + dy)
      } else {
        if (d.spaceDown) {
          d.spaceDown = false
          // Adjust startX/startY so the tangent pull is relative to the new knot position
          const dx = anchor.x - d.knotStartX
          const dy = anchor.y - d.knotStartY
          d.startX += dx
          d.startY += dy
        }

        const tx = cx - d.startX
        const ty = cy - d.startY
        if (Math.hypot(tx, ty) > 2) {
          const firstSeg = penState.segments[0]
          const closingOpposite =
            penState.pendingClose && firstSeg
              ? firstSeg.start === 0
                ? firstSeg.tangentStart
                : firstSeg.end === 0
                  ? firstSeg.tangentEnd
                  : null
              : null
          const mode = e.metaKey || e.ctrlKey ? 'continuous' : e.altKey ? 'independent' : 'default'
          if (mode !== d.modifierMode) {
            if (mode === 'default') {
              d.frozenOppositeTangent = null
            } else if (!d.frozenOppositeTangent) {
              const lastSeg = penState.segments[penState.segments.length - 1]
              d.frozenOppositeTangent = lastSeg
                ? closingOpposite
                  ? { ...closingOpposite }
                  : { ...lastSeg.tangentEnd }
                : penState.dragTangent
                  ? { x: -penState.dragTangent.x, y: -penState.dragTangent.y }
                  : { x: 0, y: 0 }
            }
            d.modifierMode = mode
          }

          if (mode === 'continuous') {
            editor.penSetDragTangent(tx, ty, {
              keepOpposite: true,
              constrainToOpposite: true,
              oppositeTangent: d.frozenOppositeTangent
            })
          } else if (mode === 'independent') {
            editor.penSetDragTangent(tx, ty, {
              keepOpposite: true,
              oppositeTangent: d.frozenOppositeTangent
            })
          } else {
            editor.penSetDragTangent(
              tx,
              ty,
              penState.pendingClose
                ? {
                    keepOpposite: true,
                    oppositeTangent: closingOpposite
                  }
                : undefined
            )
          }
        }
      }
      return
    }

    if (d.type === 'edit-node' || d.type === 'edit-handle') {
      handleNodeEditMove(d, cx, cy, editor, e.altKey, e.metaKey || e.ctrlKey, e.shiftKey)
      return
    }

    if (d.type === 'bend-handle') {
      const dx = cx - d.startX
      const dy = cy - d.startY
      if (Math.hypot(dx, dy) < 2) return
      // Lock mode on first meaningful move — persists for the rest of the drag
      if (d.lockedMode === null) {
        d.lockedMode = e.altKey ? 'independent' : 'symmetric'
      }
      if (d.dragSamples.length < 3) {
        d.dragSamples.push({ x: cx, y: cy })
      }
      if (d.targetSegmentIndex === null && d.dragSamples.length >= 3) {
        const target = resolveBendTargetHandle(nodeEditState, d.vertexIndex, d.dragSamples)
        if (target) {
          d.targetSegmentIndex = target.segmentIndex
          d.targetTangentField = target.tangentField
        }
      }
      if (d.targetSegmentIndex === null || d.targetTangentField === null) {
        return
      }
      nodeEditEditor.nodeEditBendHandle?.(
        d.vertexIndex,
        dx,
        dy,
        d.lockedMode === 'independent',
        d.targetSegmentIndex,
        d.targetTangentField
      )
      return
    }

    if (d.type === 'draw') {
      handleDrawMove(d, cx, cy, e.shiftKey, editor)
      return
    }

    handleMarqueeMove(d, cx, cy)
  }

  function onMouseUp() {
    const nodeEditEditor = editor as Editor & NodeEditMethods
    if (!drag.value) return
    const d = drag.value

    if (d.type === 'bend-handle') {
      // If no drag happened (lockedMode never set), zero all handles on this vertex
      if (d.lockedMode === null) {
        nodeEditEditor.nodeEditZeroVertexHandles?.(d.vertexIndex)
      }
      drag.value = null
      return
    }
    if (d.type === 'edit-node') {
      // Check if a single endpoint was dragged onto another endpoint → connect
      const es = (editor.state as Editor['state'] & { nodeEditState?: NodeEditState | null })
        .nodeEditState
      if (es && d.origPositions.size === 1) {
        const [draggedIdx] = d.origPositions.keys()
        if (isEndpoint(draggedIdx, es.segments)) {
          const v = es.vertices[draggedIdx]
          const iz = 1 / editor.state.zoom
          for (let i = 0; i < es.vertices.length; i++) {
            if (i === draggedIdx) continue
            if (!isEndpoint(i, es.segments)) continue
            const t = es.vertices[i]
            if (Math.hypot(v.x - t.x, v.y - t.y) < NODE_HIT_THRESHOLD * iz) {
              nodeEditEditor.nodeEditConnectEndpoints?.(draggedIdx, i)
              drag.value = null
              return
            }
          }
        }
      }
      drag.value = null
      return
    }
    if (d.type === 'edit-handle') {
      drag.value = null
      return
    }
    if (d.type === 'move') handleMoveUp(d, editor)
    else if (d.type === 'text-select') {
      drag.value = null
      return
    } else if (d.type === 'resize') editor.commitResize(d.nodeId, d.origRect)
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

  function onDblClick(e: MouseEvent) {
    const nodeEditEditor = editor as Editor & NodeEditMethods
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

    if (hit.type === 'VECTOR') {
      nodeEditEditor.enterNodeEditMode?.(hit.id)
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
