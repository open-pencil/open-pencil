import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import {
  AUTO_LAYOUT_BREAK_THRESHOLD,
  HANDLE_HIT_RADIUS,
  ROTATION_HIT_RADIUS,
  PEN_CLOSE_THRESHOLD,
  ROTATION_SNAP_DEGREES,
  ROTATION_HIT_OFFSET,
  DEFAULT_TEXT_WIDTH,
  DEFAULT_TEXT_HEIGHT
} from '@/constants'
import { computeSelectionBounds, computeSnap } from '@/engine/snap'

import type { NodeType, SceneNode } from '@/engine/scene-graph'
import type { EditorStore, Tool } from '@/stores/editor'
import type { Rect } from '@/types'

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface DragDraw {
  type: 'draw'
  startX: number
  startY: number
  nodeId: string
}

interface DragMove {
  type: 'move'
  startX: number
  startY: number
  originals: Map<string, { x: number; y: number }>
  duplicated?: boolean
  autoLayoutParentId?: string
  brokeFromAutoLayout?: boolean
}

interface DragPan {
  type: 'pan'
  startScreenX: number
  startScreenY: number
  startPanX: number
  startPanY: number
}

interface DragResize {
  type: 'resize'
  handle: HandlePosition
  startX: number
  startY: number
  origRect: Rect
  nodeId: string
}

interface DragMarquee {
  type: 'marquee'
  startX: number
  startY: number
}

interface DragRotate {
  type: 'rotate'
  nodeId: string
  centerX: number
  centerY: number
  startAngle: number
  origRotation: number
}

interface DragPen {
  type: 'pen-drag'
  startX: number
  startY: number
}

interface DragTextSelect {
  type: 'text-select'
  startX: number
  startY: number
}

type DragState =
  | DragDraw
  | DragMove
  | DragPan
  | DragResize
  | DragMarquee
  | DragRotate
  | DragPen
  | DragTextSelect

const TOOL_TO_NODE: Partial<Record<Tool, NodeType>> = {
  FRAME: 'FRAME',
  SECTION: 'SECTION',
  RECTANGLE: 'RECTANGLE',
  ELLIPSE: 'ELLIPSE',
  LINE: 'LINE',
  POLYGON: 'POLYGON',
  STAR: 'STAR',
  TEXT: 'TEXT'
}

const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize'
}

function getScreenRect(
  absX: number,
  absY: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number
) {
  return {
    x1: absX * zoom + panX,
    y1: absY * zoom + panY,
    x2: (absX + w) * zoom + panX,
    y2: (absY + h) * zoom + panY
  }
}

function getHandlePositions(
  absX: number,
  absY: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const { x1, y1, x2, y2 } = getScreenRect(absX, absY, w, h, zoom, panX, panY)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2

  return {
    nw: { x: x1, y: y1 },
    n: { x: mx, y: y1 },
    ne: { x: x2, y: y1 },
    e: { x: x2, y: my },
    se: { x: x2, y: y2 },
    s: { x: mx, y: y2 },
    sw: { x: x1, y: y2 },
    w: { x: x1, y: my }
  } as Record<HandlePosition, { x: number; y: number }>
}

function unrotate(
  sx: number,
  sy: number,
  centerX: number,
  centerY: number,
  rotation: number
): { sx: number; sy: number } {
  if (rotation === 0) return { sx, sy }
  const rad = (-rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = sx - centerX
  const dy = sy - centerY
  return {
    sx: centerX + dx * cos - dy * sin,
    sy: centerY + dx * sin + dy * cos
  }
}

function hitTestHandle(
  sx: number,
  sy: number,
  absX: number,
  absY: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number,
  rotation = 0
): HandlePosition | null {
  const { x1, y1, x2, y2 } = getScreenRect(absX, absY, w, h, zoom, panX, panY)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const ur = unrotate(sx, sy, cx, cy, rotation)

  const handles = getHandlePositions(absX, absY, w, h, zoom, panX, panY)
  for (const [pos, pt] of Object.entries(handles)) {
    if (Math.abs(ur.sx - pt.x) < HANDLE_HIT_RADIUS && Math.abs(ur.sy - pt.y) < HANDLE_HIT_RADIUS) {
      return pos as HandlePosition
    }
  }
  return null
}

function hitTestRotationHandle(
  sx: number,
  sy: number,
  absX: number,
  absY: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number,
  rotation = 0
): boolean {
  const { x1, x2, y1, y2 } = getScreenRect(absX, absY, w, h, zoom, panX, panY)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const ur = unrotate(sx, sy, cx, cy, rotation)

  const mx = (x1 + x2) / 2
  const rotY = y1 - ROTATION_HIT_OFFSET
  return Math.abs(ur.sx - mx) < ROTATION_HIT_RADIUS && Math.abs(ur.sy - rotY) < ROTATION_HIT_RADIUS
}

export function useCanvasInput(
  canvasRef: Ref<HTMLCanvasElement | null>,
  store: EditorStore,
  hitTestSectionTitle: (cx: number, cy: number) => import('@/engine/scene-graph').SceneNode | null,
  hitTestComponentLabel: (
    cx: number,
    cy: number
  ) => import('@/engine/scene-graph').SceneNode | null,
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
    const { x: cx, y: cy } = store.screenToCanvas(sx, sy)
    return { sx, sy, cx, cy }
  }

  function onMouseDown(e: MouseEvent) {
    store.setHoveredNode(null)
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
    const tool = store.state.activeTool

    if (e.button === 1 || tool === 'HAND') {
      drag.value = {
        type: 'pan',
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startPanX: store.state.panX,
        startPanY: store.state.panY
      }
      return
    }

    if (tool === 'SELECT' && e.altKey && !store.state.selectedIds.size) {
      drag.value = {
        type: 'pan',
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startPanX: store.state.panX,
        startPanY: store.state.panY
      }
      return
    }

    if (tool === 'SELECT') {
      if (store.state.editingTextId) {
        const editor = store.textEditor
        const editNode = store.graph.getNode(store.state.editingTextId)
        if (editor && editNode) {
          const abs = store.graph.getAbsolutePosition(editNode.id)
          const localX = cx - abs.x
          const localY = cy - abs.y
          if (localX >= 0 && localY >= 0 && localX <= editNode.width && localY <= editNode.height) {
            if (clickCount >= 3) {
              editor.selectAll()
            } else if (clickCount === 2) {
              editor.selectWordAt(localX, localY)
            } else {
              editor.setCursorAt(localX, localY, e.shiftKey)
              drag.value = { type: 'text-select', startX: cx, startY: cy } as DragState
            }
            store.requestRender()
            return
          }
        }
        store.commitTextEdit()
      }

      // Check rotation handle (single selection only)
      if (store.state.selectedIds.size === 1) {
        const id = [...store.state.selectedIds][0]
        const node = store.graph.getNode(id)
        if (node) {
          const abs = store.graph.getAbsolutePosition(id)
          if (
            hitTestRotationHandle(
              sx,
              sy,
              abs.x,
              abs.y,
              node.width,
              node.height,
              store.state.zoom,
              store.state.panX,
              store.state.panY,
              node.rotation
            )
          ) {
            const screenCx = (abs.x + node.width / 2) * store.state.zoom + store.state.panX
            const screenCy = (abs.y + node.height / 2) * store.state.zoom + store.state.panY
            const startAngle = Math.atan2(sy - screenCy, sx - screenCx) * (180 / Math.PI)
            drag.value = {
              type: 'rotate',
              nodeId: id,
              centerX: screenCx,
              centerY: screenCy,
              startAngle,
              origRotation: node.rotation
            }
            return
          }
        }
      }

      // Check resize handles
      for (const id of store.state.selectedIds) {
        const node = store.graph.getNode(id)
        if (!node) continue
        const abs = store.graph.getAbsolutePosition(id)
        const handle = hitTestHandle(
          sx,
          sy,
          abs.x,
          abs.y,
          node.width,
          node.height,
          store.state.zoom,
          store.state.panX,
          store.state.panY,
          node.rotation
        )
        if (handle) {
          drag.value = {
            type: 'resize',
            handle,
            startX: cx,
            startY: cy,
            origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
            nodeId: id
          }
          return
        }
      }

      // Hit test nodes (labels first, then body)
      const hit =
        hitTestSectionTitle(cx, cy) ??
        hitTestComponentLabel(cx, cy) ??
        store.graph.hitTest(cx, cy, store.state.currentPageId)
      if (hit) {
        if (!store.state.selectedIds.has(hit.id) && !e.shiftKey) {
          store.select([hit.id])
        } else if (e.shiftKey) {
          store.select([hit.id], true)
        }

        const originals = new Map<string, { x: number; y: number }>()
        for (const id of store.state.selectedIds) {
          const n = store.graph.getNode(id)
          if (n) originals.set(id, { x: n.x, y: n.y })
        }

        // Alt+drag → duplicate
        if (e.altKey && store.state.selectedIds.size > 0) {
          const newIds: string[] = []
          const newOriginals = new Map<string, { x: number; y: number }>()
          for (const id of store.state.selectedIds) {
            const src = store.graph.getNode(id)
            if (!src) continue
            const newId = store.createShape(src.type, src.x, src.y, src.width, src.height)
            store.graph.updateNode(newId, {
              name: src.name + ' copy',
              fills: [...src.fills],
              strokes: [...src.strokes],
              effects: [...src.effects],
              cornerRadius: src.cornerRadius,
              opacity: src.opacity,
              rotation: src.rotation
            })
            newIds.push(newId)
            newOriginals.set(newId, { x: src.x, y: src.y })
          }
          store.select(newIds)
          drag.value = {
            type: 'move',
            startX: cx,
            startY: cy,
            originals: newOriginals,
            duplicated: true
          }
          store.requestRender()
          return
        }

        // Detect if we're inside an auto-layout frame
        let autoLayoutParentId: string | undefined
        if (store.state.selectedIds.size === 1) {
          const selectedId = [...store.state.selectedIds][0]
          const selectedNode = store.graph.getNode(selectedId)
          if (selectedNode?.parentId) {
            const parent = store.graph.getNode(selectedNode.parentId)
            if (
              parent &&
              parent.layoutMode !== 'NONE' &&
              selectedNode.layoutPositioning !== 'ABSOLUTE'
            ) {
              autoLayoutParentId = parent.id
            }
          }
        }

        drag.value = { type: 'move', startX: cx, startY: cy, originals, autoLayoutParentId }
      } else {
        store.clearSelection()
        drag.value = { type: 'marquee', startX: cx, startY: cy }
      }
      return
    }

    // Pen tool: click to add vertices
    if (tool === 'PEN') {
      store.penAddVertex(cx, cy)
      drag.value = { type: 'pen-drag', startX: cx, startY: cy } as DragState
      return
    }

    // Text tool: click to create text node
    if (tool === 'TEXT') {
      const nodeId = store.createShape('TEXT', cx, cy, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT)
      store.graph.updateNode(nodeId, { text: '' })
      store.select([nodeId])
      store.startTextEditing(nodeId)
      store.setTool('SELECT')
      store.requestRender()
      return
    }

    // Shape creation
    const nodeType = TOOL_TO_NODE[tool]
    if (!nodeType) return

    const nodeId = store.createShape(nodeType, cx, cy, 0, 0)
    store.select([nodeId])

    drag.value = { type: 'draw', startX: cx, startY: cy, nodeId }
  }

  function onMouseMove(e: MouseEvent) {
    if (onCursorMove) {
      const { cx, cy } = getCoords(e)
      onCursorMove(cx, cy)
    }

    // Pen tool: track cursor for preview line
    if (store.state.activeTool === 'PEN' && store.state.penState && !drag.value) {
      const { cx, cy } = getCoords(e)
      store.state.penCursorX = cx
      store.state.penCursorY = cy

      // Check proximity to first vertex for closing
      const first = store.state.penState.vertices[0]
      if (store.state.penState.vertices.length > 2 && first) {
        const dist = Math.hypot(cx - first.x, cy - first.y)
        store.penSetClosingToFirst(dist < PEN_CLOSE_THRESHOLD)
      }
      store.requestRepaint()
    }

    // Cursor + hover highlight
    if (!drag.value && store.state.activeTool === 'SELECT') {
      const { sx, sy, cx, cy } = getCoords(e)
      let cursor: string | null = null

      // Rotation handle cursor
      if (store.state.selectedIds.size === 1) {
        const id = [...store.state.selectedIds][0]
        const node = store.graph.getNode(id)
        if (node) {
          const abs = store.graph.getAbsolutePosition(id)
          if (
            hitTestRotationHandle(
              sx,
              sy,
              abs.x,
              abs.y,
              node.width,
              node.height,
              store.state.zoom,
              store.state.panX,
              store.state.panY,
              node.rotation
            )
          ) {
            cursor = 'grab'
          }
        }
      }

      if (!cursor) {
        for (const id of store.state.selectedIds) {
          const node = store.graph.getNode(id)
          if (!node) continue
          const abs = store.graph.getAbsolutePosition(id)
          const handle = hitTestHandle(
            sx,
            sy,
            abs.x,
            abs.y,
            node.width,
            node.height,
            store.state.zoom,
            store.state.panX,
            store.state.panY,
            node.rotation
          )
          if (handle) {
            cursor = HANDLE_CURSORS[handle]
            break
          }
        }
      }
      cursorOverride.value = cursor

      const hit =
        hitTestSectionTitle(cx, cy) ??
        hitTestComponentLabel(cx, cy) ??
        store.graph.hitTest(cx, cy, store.state.currentPageId)
      store.setHoveredNode(hit && !store.state.selectedIds.has(hit.id) ? hit.id : null)
    }

    if (!drag.value) return
    const d = drag.value

    if (d.type === 'pan') {
      const dx = e.clientX - d.startScreenX
      const dy = e.clientY - d.startScreenY
      store.state.panX = d.startPanX + dx
      store.state.panY = d.startPanY + dy
      store.requestRepaint()
      return
    }

    const { cx, cy, sx, sy } = getCoords(e)

    if (d.type === 'rotate') {
      const currentAngle = Math.atan2(sy - d.centerY, sx - d.centerX) * (180 / Math.PI)
      let rotation = d.origRotation + (currentAngle - d.startAngle)

      // Shift → snap to 15° increments
      if (e.shiftKey) {
        rotation = Math.round(rotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES
      }

      // Normalize to -180..180
      rotation = ((((rotation + 180) % 360) + 360) % 360) - 180

      store.setRotationPreview({ nodeId: d.nodeId, angle: rotation })
      return
    }

    if (d.type === 'move') {
      let dx = cx - d.startX
      let dy = cy - d.startY

      // Auto-layout: dead zone before breaking out
      if (d.autoLayoutParentId && !d.brokeFromAutoLayout) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < AUTO_LAYOUT_BREAK_THRESHOLD) {
          // Still in dead zone — compute insertion indicator within parent
          computeAutoLayoutIndicator(d, cx, cy)
          return
        }
        d.brokeFromAutoLayout = true
        store.setLayoutInsertIndicator(null)
      }

      // Check if we're hovering over an auto-layout frame
      let dropTarget = store.graph.hitTestFrame(
        cx,
        cy,
        store.state.selectedIds,
        store.state.currentPageId
      )
      // Sections can't be dropped into frames or groups
      const movingSection = [...store.state.selectedIds].some(
        (id) => store.graph.getNode(id)?.type === 'SECTION'
      )
      if (
        movingSection &&
        dropTarget &&
        dropTarget.type !== 'SECTION' &&
        dropTarget.type !== 'CANVAS'
      ) {
        dropTarget = null
      }
      const dropParent = dropTarget ? store.graph.getNode(dropTarget.id) : null

      if (dropParent && dropParent.layoutMode !== 'NONE') {
        computeAutoLayoutIndicatorForFrame(dropParent, cx, cy)
        store.setDropTarget(dropParent.id)

        // Still move the nodes freely so the user sees them floating
        for (const [id, orig] of d.originals) {
          store.graph.updateNode(id, {
            x: Math.round(orig.x + dx),
            y: Math.round(orig.y + dy)
          })
        }
        store.requestRender()
        return
      }

      store.setLayoutInsertIndicator(null)

      // Compute snap using absolute positions
      const selectedNodes: SceneNode[] = []
      for (const [id, orig] of d.originals) {
        const n = store.graph.getNode(id)
        if (n) {
          const abs = store.graph.getAbsolutePosition(id)
          const parentAbs = n.parentId
            ? store.graph.getAbsolutePosition(n.parentId)
            : { x: 0, y: 0 }
          selectedNodes.push({
            ...n,
            x: abs.x - parentAbs.x - n.x + orig.x + dx,
            y: abs.y - parentAbs.y - n.y + orig.y + dy
          })
        }
      }

      const bounds = computeSelectionBounds(selectedNodes)
      if (bounds) {
        // Snap against siblings in absolute coordinates
        const firstId = [...d.originals.keys()][0]
        const firstNode = store.graph.getNode(firstId)
        const parentId = firstNode?.parentId ?? store.state.currentPageId
        const siblings = store.graph.getChildren(parentId)
        const parentAbs = !store.isTopLevel(parentId)
          ? store.graph.getAbsolutePosition(parentId)
          : { x: 0, y: 0 }
        const absTargets = siblings.map((n) => ({
          ...n,
          x: n.x + parentAbs.x,
          y: n.y + parentAbs.y
        }))
        // Convert moving bounds to absolute coords too
        const absBounds = {
          x: bounds.x + parentAbs.x,
          y: bounds.y + parentAbs.y,
          width: bounds.width,
          height: bounds.height
        }
        const snap = computeSnap(store.state.selectedIds, absBounds, absTargets)
        dx += snap.dx
        dy += snap.dy
        store.setSnapGuides(snap.guides)
      }

      for (const [id, orig] of d.originals) {
        store.updateNode(id, { x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) })
      }

      store.setDropTarget(dropTarget?.id ?? null)
      return
    }

    if (d.type === 'text-select') {
      const editor = store.textEditor
      const editNode = store.state.editingTextId
        ? store.graph.getNode(store.state.editingTextId)
        : null
      if (editor && editNode) {
        const abs = store.graph.getAbsolutePosition(editNode.id)
        editor.setCursorAt(cx - abs.x, cy - abs.y, true)
        store.requestRender()
      }
      return
    }

    if (d.type === 'resize') {
      applyResize(d, cx, cy, e.shiftKey)
      return
    }

    if (d.type === 'pen-drag') {
      const tx = cx - d.startX
      const ty = cy - d.startY
      if (Math.hypot(tx, ty) > 2) {
        store.penSetDragTangent(tx, ty)
      }
      return
    }

    if (d.type === 'draw') {
      let w = cx - d.startX
      let h = cy - d.startY

      if (e.shiftKey) {
        const size = Math.max(Math.abs(w), Math.abs(h))
        w = Math.sign(w) * size
        h = Math.sign(h) * size
      }

      store.updateNode(d.nodeId, {
        x: w < 0 ? d.startX + w : d.startX,
        y: h < 0 ? d.startY + h : d.startY,
        width: Math.abs(w),
        height: Math.abs(h)
      })
      return
    }

    if (d.type === 'marquee') {
      const minX = Math.min(d.startX, cx)
      const minY = Math.min(d.startY, cy)
      const maxX = Math.max(d.startX, cx)
      const maxY = Math.max(d.startY, cy)

      const hits: string[] = []
      for (const node of store.graph.getChildren(store.state.currentPageId)) {
        if (
          node.x + node.width > minX &&
          node.x < maxX &&
          node.y + node.height > minY &&
          node.y < maxY
        ) {
          hits.push(node.id)
        }
      }
      store.select(hits)
      store.setMarquee({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
    }
  }

  function applyResize(d: DragResize, cx: number, cy: number, constrain: boolean) {
    const { handle, origRect } = d
    let { x, y, width, height } = origRect
    const dx = cx - d.startX
    const dy = cy - d.startY

    const moveLeft = handle.includes('w')
    const moveRight = handle.includes('e')
    const moveTop = handle === 'nw' || handle === 'n' || handle === 'ne'
    const moveBottom = handle === 'sw' || handle === 's' || handle === 'se'

    if (moveRight) width = origRect.width + dx
    if (moveLeft) {
      x = origRect.x + dx
      width = origRect.width - dx
    }
    if (moveBottom) height = origRect.height + dy
    if (moveTop) {
      y = origRect.y + dy
      height = origRect.height - dy
    }

    if (constrain && origRect.width > 0 && origRect.height > 0) {
      const aspect = origRect.width / origRect.height
      if (handle === 'n' || handle === 's') {
        width = Math.abs(height) * aspect
        x = origRect.x + (origRect.width - width) / 2
      } else if (handle === 'e' || handle === 'w') {
        height = Math.abs(width) / aspect
        y = origRect.y + (origRect.height - height) / 2
      } else {
        if (Math.abs(dx) > Math.abs(dy)) {
          height = (Math.abs(width) / aspect) * Math.sign(height || 1)
          if (moveTop) y = origRect.y + origRect.height - Math.abs(height)
        } else {
          width = Math.abs(height) * aspect * Math.sign(width || 1)
          if (moveLeft) x = origRect.x + origRect.width - Math.abs(width)
        }
      }
    }

    if (width < 0) {
      x = x + width
      width = -width
    }
    if (height < 0) {
      y = y + height
      height = -height
    }

    store.updateNode(d.nodeId, {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.max(1, width)),
      height: Math.round(Math.max(1, height))
    })
  }

  function onMouseUp() {
    if (!drag.value) return
    const d = drag.value

    if (d.type === 'move') {
      const indicator = store.state.layoutInsertIndicator
      store.setLayoutInsertIndicator(null)
      store.setSnapGuides([])

      if (indicator) {
        // Drop into auto-layout at the indicated position
        for (const id of store.state.selectedIds) {
          store.reorderInAutoLayout(id, indicator.parentId, indicator.index)
        }
        store.setDropTarget(null)
      } else {
        // Check if the user actually dragged
        const moved = [...d.originals].some(([id, orig]) => {
          const node = store.graph.getNode(id)
          return node && (node.x !== orig.x || node.y !== orig.y)
        })

        if (moved) {
          store.commitMove(d.originals)

          // Reparent into frame if dropped on one
          const dropId = store.state.dropTargetId
          if (dropId) {
            store.reparentNodes([...store.state.selectedIds], dropId)
          } else {
            // Reparent to grandparent if dragged outside parent bounds
            for (const id of store.state.selectedIds) {
              const node = store.graph.getNode(id)
              if (!node?.parentId || store.isTopLevel(node.parentId)) continue
              const parent = store.graph.getNode(node.parentId)
              if (!parent || (parent.type !== 'FRAME' && parent.type !== 'SECTION')) continue
              const outsideX = node.x + node.width < 0 || node.x > parent.width
              const outsideY = node.y + node.height < 0 || node.y > parent.height
              if (outsideX || outsideY) {
                const grandparentId = parent.parentId ?? store.state.currentPageId
                store.graph.reparentNode(id, grandparentId)
              }
            }
          }
        }
        store.setDropTarget(null)
      }
    }

    if (d.type === 'text-select') {
      drag.value = null
      return
    }

    if (d.type === 'resize') {
      store.commitResize(d.nodeId, d.origRect)
    }

    if (d.type === 'pen-drag') {
      drag.value = null
      return
    }

    if (d.type === 'rotate') {
      const preview = store.state.rotationPreview
      if (preview) {
        store.updateNode(d.nodeId, { rotation: preview.angle })
        store.commitRotation(d.nodeId, d.origRotation)
      }
      store.setRotationPreview(null)
    }

    if (d.type === 'draw') {
      const node = store.graph.getNode(d.nodeId)
      if (node && node.width < 2 && node.height < 2) {
        store.updateNode(d.nodeId, { width: 100, height: 100 })
      }
      if (node?.type === 'SECTION') {
        store.adoptNodesIntoSection(node.id)
      }
      store.setTool('SELECT')
    }

    if (d.type === 'marquee') {
      store.setMarquee(null)
    }

    drag.value = null
    cursorOverride.value = null
  }

  let wheelAccum = {
    deltaX: 0,
    deltaY: 0,
    zoomDelta: 0,
    zoomCenterX: 0,
    zoomCenterY: 0,
    hasZoom: false,
    rafId: 0
  }

  function flushWheel() {
    wheelAccum.rafId = 0
    store.setHoveredNode(null)
    if (wheelAccum.hasZoom) {
      store.applyZoom(wheelAccum.zoomDelta, wheelAccum.zoomCenterX, wheelAccum.zoomCenterY)
    } else {
      store.pan(wheelAccum.deltaX, wheelAccum.deltaY)
    }
    wheelAccum.deltaX = 0
    wheelAccum.deltaY = 0
    wheelAccum.zoomDelta = 0
    wheelAccum.hasZoom = false
  }

  // Normalize wheel deltaY across deltaMode variants (line/page/pixel).
  // Trackpad pinch is always DOM_DELTA_PIXEL; external mice may use LINE or PAGE.
  function normalizeWheelDelta(e: WheelEvent): { dx: number; dy: number } {
    let { deltaX, deltaY } = e
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      deltaX *= 40
      deltaY *= 40
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      deltaX *= 800
      deltaY *= 800
    }
    return { dx: deltaX, dy: deltaY }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const canvas = canvasRef.value
    if (!canvas) return
    const { dx, dy } = normalizeWheelDelta(e)

    if (e.ctrlKey || e.metaKey) {
      const rect = canvas.getBoundingClientRect()
      wheelAccum.zoomCenterX = e.clientX - rect.left
      wheelAccum.zoomCenterY = e.clientY - rect.top
      wheelAccum.zoomDelta += dy
      wheelAccum.hasZoom = true
    } else {
      wheelAccum.deltaX -= dx
      wheelAccum.deltaY -= dy
    }
    if (!wheelAccum.rafId) {
      wheelAccum.rafId = requestAnimationFrame(flushWheel)
    }
  }

  function onDblClick(e: MouseEvent) {
    if (store.state.editingTextId) return

    const { cx, cy } = getCoords(e)
    const hit =
      hitTestSectionTitle(cx, cy) ??
      hitTestComponentLabel(cx, cy) ??
      store.graph.hitTestDeep(cx, cy, store.state.currentPageId)
    if (!hit) return

    if (hit.type === 'TEXT') {
      store.select([hit.id])
      store.startTextEditing(hit.id)
      const editor = store.textEditor
      if (editor) {
        const abs = store.graph.getAbsolutePosition(hit.id)
        editor.selectWordAt(cx - abs.x, cy - abs.y)
        store.requestRender()
      }
      return
    }

    store.select([hit.id])
  }

  function computeAutoLayoutIndicator(d: DragMove, cx: number, cy: number) {
    if (!d.autoLayoutParentId) return
    const parent = store.graph.getNode(d.autoLayoutParentId)
    if (!parent || parent.layoutMode === 'NONE') return
    computeAutoLayoutIndicatorForFrame(parent, cx, cy)
  }

  function computeAutoLayoutIndicatorForFrame(parent: SceneNode, cx: number, cy: number) {
    const children = store.graph
      .getChildren(parent.id)
      .filter((c) => c.layoutPositioning !== 'ABSOLUTE' && !store.state.selectedIds.has(c.id))

    const parentAbs = store.graph.getAbsolutePosition(parent.id)
    const isRow = parent.layoutMode === 'HORIZONTAL'

    let insertIndex = children.length

    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      const childAbs = store.graph.getAbsolutePosition(child.id)
      const mid = isRow ? childAbs.x + child.width / 2 : childAbs.y + child.height / 2
      const cursor = isRow ? cx : cy

      if (cursor < mid) {
        insertIndex = i
        break
      }
    }

    // Compute indicator position
    let indicatorPos: number
    const crossStart = isRow ? parentAbs.y + parent.paddingTop : parentAbs.x + parent.paddingLeft
    const crossLength = isRow
      ? parent.height - parent.paddingTop - parent.paddingBottom
      : parent.width - parent.paddingLeft - parent.paddingRight

    if (children.length === 0) {
      indicatorPos = isRow ? parentAbs.x + parent.paddingLeft : parentAbs.y + parent.paddingTop
    } else if (insertIndex === 0) {
      const first = children[0]
      const firstAbs = store.graph.getAbsolutePosition(first.id)
      indicatorPos = isRow
        ? firstAbs.x - parent.itemSpacing / 2
        : firstAbs.y - parent.itemSpacing / 2
    } else if (insertIndex >= children.length) {
      const last = children[children.length - 1]
      const lastAbs = store.graph.getAbsolutePosition(last.id)
      indicatorPos = isRow
        ? lastAbs.x + last.width + parent.itemSpacing / 2
        : lastAbs.y + last.height + parent.itemSpacing / 2
    } else {
      const prev = children[insertIndex - 1]
      const next = children[insertIndex]
      const prevAbs = store.graph.getAbsolutePosition(prev.id)
      const nextAbs = store.graph.getAbsolutePosition(next.id)
      indicatorPos = isRow
        ? (prevAbs.x + prev.width + nextAbs.x) / 2
        : (prevAbs.y + prev.height + nextAbs.y) / 2
    }

    // Account for the dragged node being in the children list
    // (we filtered it out, so insertIndex is relative to the filtered list)
    // Convert to actual childIds index
    const allChildren = store.graph.getChildren(parent.id)
    let realIndex = 0
    let filteredCount = 0
    for (let i = 0; i < allChildren.length; i++) {
      if (store.state.selectedIds.has(allChildren[i].id)) continue
      if (allChildren[i].layoutPositioning === 'ABSOLUTE') {
        realIndex++
        continue
      }
      if (filteredCount === insertIndex) break
      filteredCount++
      realIndex++
    }

    store.setLayoutInsertIndicator({
      parentId: parent.id,
      index: realIndex,
      x: isRow ? indicatorPos : crossStart,
      y: isRow ? crossStart : indicatorPos,
      length: crossLength,
      direction: isRow ? 'VERTICAL' : 'HORIZONTAL'
    })
  }

  let activeTouches: Touch[] = []
  let pinchStartDist = 0
  let pinchStartZoom = 0
  let pinchMidX = 0
  let pinchMidY = 0

  function touchDist(a: Touch, b: Touch) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  let touchAsMouse = false

  function syntheticMouse(type: string, t: Touch): MouseEvent {
    return new MouseEvent(type, {
      clientX: t.clientX,
      clientY: t.clientY,
      screenX: t.screenX,
      screenY: t.screenY,
      button: 0,
      buttons: 1,
      bubbles: true
    })
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault()
    activeTouches = Array.from(e.touches)
    const canvas = canvasRef.value
    if (!canvas) return

    if (activeTouches.length === 2) {
      if (touchAsMouse) {
        onMouseUp()
        touchAsMouse = false
      }
      drag.value = null
      const [a, b] = activeTouches
      pinchStartDist = touchDist(a, b)
      pinchStartZoom = store.state.zoom
      const rect = canvas.getBoundingClientRect()
      pinchMidX = (a.clientX + b.clientX) / 2 - rect.left
      pinchMidY = (a.clientY + b.clientY) / 2 - rect.top
    } else if (activeTouches.length === 1) {
      const t = activeTouches[0]
      const tool = store.state.activeTool
      if (tool === 'HAND') {
        touchAsMouse = false
        drag.value = {
          type: 'pan',
          startScreenX: t.clientX,
          startScreenY: t.clientY,
          startPanX: store.state.panX,
          startPanY: store.state.panY
        }
      } else {
        touchAsMouse = true
        onMouseDown(syntheticMouse('mousedown', t))
      }
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault()
    activeTouches = Array.from(e.touches)
    const canvas = canvasRef.value
    if (!canvas) return

    if (activeTouches.length === 2) {
      const [a, b] = activeTouches
      const rect = canvas.getBoundingClientRect()
      const newMidX = (a.clientX + b.clientX) / 2 - rect.left
      const newMidY = (a.clientY + b.clientY) / 2 - rect.top

      store.setHoveredNode(null)
      const newDist = touchDist(a, b)
      if (pinchStartDist > 0) {
        const scale = newDist / pinchStartDist
        const newZoom = Math.max(0.02, Math.min(256, pinchStartZoom * scale))
        const zoomRatio = newZoom / store.state.zoom

        const panDx = newMidX - pinchMidX
        const panDy = newMidY - pinchMidY

        store.state.panX = pinchMidX - (pinchMidX - store.state.panX) * zoomRatio + panDx
        store.state.panY = pinchMidY - (pinchMidY - store.state.panY) * zoomRatio + panDy
        store.state.zoom = newZoom
      }

      pinchMidX = newMidX
      pinchMidY = newMidY
      store.requestRepaint()
    } else if (activeTouches.length === 1) {
      const t = activeTouches[0]
      if (touchAsMouse) {
        onMouseMove(syntheticMouse('mousemove', t))
      } else if (drag.value?.type === 'pan') {
        const d = drag.value
        store.state.panX = d.startPanX + (t.clientX - d.startScreenX)
        store.state.panY = d.startPanY + (t.clientY - d.startScreenY)
        store.requestRepaint()
      }
    }
  }

  function onTouchEnd(e: TouchEvent) {
    e.preventDefault()
    activeTouches = Array.from(e.touches)

    if (activeTouches.length === 0) {
      if (touchAsMouse) {
        onMouseUp()
        touchAsMouse = false
      } else {
        drag.value = null
      }
      pinchStartDist = 0
    } else if (activeTouches.length === 1) {
      const t = activeTouches[0]
      if (!touchAsMouse) {
        drag.value = {
          type: 'pan',
          startScreenX: t.clientX,
          startScreenY: t.clientY,
          startPanX: store.state.panX,
          startPanY: store.state.panY
        }
      }
      pinchStartDist = 0
    }
  }

  useEventListener(canvasRef, 'dblclick', onDblClick)
  useEventListener(canvasRef, 'mousedown', onMouseDown)
  useEventListener(canvasRef, 'mousemove', onMouseMove)
  useEventListener(canvasRef, 'mouseup', onMouseUp)
  useEventListener(canvasRef, 'mouseleave', () => {
    onMouseUp()
    store.setHoveredNode(null)
  })
  useEventListener(canvasRef, 'wheel', onWheel, { passive: false })
  useEventListener(canvasRef, 'touchstart', onTouchStart, { passive: false })
  useEventListener(canvasRef, 'touchmove', onTouchMove, { passive: false })
  useEventListener(canvasRef, 'touchend', onTouchEnd, { passive: false })
  useEventListener(canvasRef, 'touchcancel', onTouchEnd, { passive: false })

  // Safari macOS: trackpad pinch-to-zoom uses gesture events, not wheel+ctrlKey
  let gestureStartZoom = 1
  let gestureRafId = 0
  let pendingGesture: { scale: number; sx: number; sy: number } | null = null

  function flushGesture() {
    gestureRafId = 0
    if (!pendingGesture) return
    store.setHoveredNode(null)
    const { scale, sx, sy } = pendingGesture
    pendingGesture = null
    const newZoom = Math.max(0.02, Math.min(256, gestureStartZoom * scale))
    const zoomRatio = newZoom / store.state.zoom
    store.state.panX = sx - (sx - store.state.panX) * zoomRatio
    store.state.panY = sy - (sy - store.state.panY) * zoomRatio
    store.state.zoom = newZoom
    store.requestRepaint()
  }

  useEventListener(
    canvasRef,
    'gesturestart' as keyof HTMLElementEventMap,
    (e: Event) => {
      e.preventDefault()
      gestureStartZoom = store.state.zoom
    },
    { passive: false }
  )
  useEventListener(
    canvasRef,
    'gesturechange' as keyof HTMLElementEventMap,
    (e: Event) => {
      e.preventDefault()
      const ge = e as GestureEvent
      const canvas = canvasRef.value
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      pendingGesture = {
        scale: ge.scale,
        sx: (ge.clientX ?? rect.width / 2) - rect.left,
        sy: (ge.clientY ?? rect.height / 2) - rect.top
      }
      if (!gestureRafId) {
        gestureRafId = requestAnimationFrame(flushGesture)
      }
    },
    { passive: false }
  )
  useEventListener(
    canvasRef,
    'gestureend' as keyof HTMLElementEventMap,
    (e: Event) => {
      e.preventDefault()
    },
    { passive: false }
  )

  return {
    drag,
    cursorOverride
  }
}
