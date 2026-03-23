import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import {
  AUTO_LAYOUT_BREAK_THRESHOLD,
  CORNER_ROTATE_ZONE,
  HANDLE_HIT_RADIUS,
  PEN_CLOSE_THRESHOLD,
  ROTATION_SNAP_DEGREES,
  DEFAULT_TEXT_WIDTH,
  DEFAULT_TEXT_HEIGHT
} from '@/constants'
import { computeSelectionBounds, computeSnap, degToRad } from '@open-pencil/core'

import type { EditorStore, Tool } from '@/stores/editor'
import type { NodeType, Rect, SceneNode, Vector } from '@open-pencil/core'

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
  originals: Map<string, { x: number; y: number; parentId: string }>
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
  } satisfies Record<HandlePosition, Vector>
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

type CornerPosition = 'nw' | 'ne' | 'se' | 'sw'

function hitTestCornerRotation(
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
): CornerPosition | null {
  const { x1, y1, x2, y2 } = getScreenRect(absX, absY, w, h, zoom, panX, panY)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const ur = unrotate(sx, sy, cx, cy, rotation)

  const corners: Array<{ pos: CornerPosition; x: number; y: number }> = [
    { pos: 'nw', x: x1, y: y1 },
    { pos: 'ne', x: x2, y: y1 },
    { pos: 'se', x: x2, y: y2 },
    { pos: 'sw', x: x1, y: y2 }
  ]

  for (const { pos, x, y } of corners) {
    const dx = Math.abs(ur.sx - x)
    const dy = Math.abs(ur.sy - y)
    if (
      dx <= CORNER_ROTATE_ZONE &&
      dy <= CORNER_ROTATE_ZONE &&
      (dx > HANDLE_HIT_RADIUS || dy > HANDLE_HIT_RADIUS)
    ) {
      return pos
    }
  }
  return null
}

const CORNER_BASE_ANGLES: Record<CornerPosition, number> = { nw: 0, ne: 90, se: 180, sw: 270 }

import rotateCursorSvg from '@/assets/rotate-cursor.svg?raw'

const rotationCursorCache = new Map<number, string>()

function buildRotationCursor(angleDeg: number): string {
  const key = Math.round(angleDeg) % 360
  let cached = rotationCursorCache.get(key)
  if (cached) return cached
  let svg: string
  if (key === 0) {
    svg = rotateCursorSvg
  } else {
    svg = rotateCursorSvg
      .replace(
        '<path',
        `<g transform='translate(1002 2110) rotate(${key}) translate(-1002 -2110)'><path`
      )
      .replace('</svg>', '</g></svg>')
  }
  cached = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`
  rotationCursorCache.set(key, cached)
  return cached
}

function cornerRotationCursor(corner: CornerPosition, nodeRotation = 0): string {
  return buildRotationCursor(CORNER_BASE_ANGLES[corner] + nodeRotation)
}

export function useCanvasInput(
  canvasRef: Ref<HTMLCanvasElement | null>,
  store: EditorStore,
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
    const { x: cx, y: cy } = store.screenToCanvas(sx, sy)
    return { sx, sy, cx, cy }
  }

  function canvasToLocal(cx: number, cy: number, scopeId: string): { lx: number; ly: number } {
    const node = store.graph.getNode(scopeId)
    if (!node) return { lx: cx, ly: cy }
    const abs = store.graph.getAbsolutePosition(scopeId)
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
    const scopeId = store.state.enteredContainerId
    if (scopeId) {
      if (!store.graph.getNode(scopeId)) {
        store.state.enteredContainerId = null
      } else {
        const { lx, ly } = canvasToLocal(cx, cy, scopeId)
        return deep
          ? store.graph.hitTestDeep(lx, ly, scopeId)
          : store.graph.hitTest(lx, ly, scopeId)
      }
    }
    return deep
      ? store.graph.hitTestDeep(cx, cy, store.state.currentPageId)
      : store.graph.hitTest(cx, cy, store.state.currentPageId)
  }

  function isInsideContainerBounds(cx: number, cy: number, containerId: string): boolean {
    const container = store.graph.getNode(containerId)
    if (!container) return false
    const { lx, ly } = canvasToLocal(cx, cy, containerId)
    return lx >= 0 && lx <= container.width && ly >= 0 && ly <= container.height
  }

  function startPanDrag(e: MouseEvent) {
    drag.value = {
      type: 'pan',
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startPanX: store.state.panX,
      startPanY: store.state.panY
    }
  }

  function handleTextEditClick(cx: number, cy: number, shiftKey: boolean): boolean {
    const editor = store.textEditor
    const editNode = store.state.editingTextId
      ? store.graph.getNode(store.state.editingTextId)
      : null
    if (!editor || !editNode) {
      store.commitTextEdit()
      return false
    }
    const abs = store.graph.getAbsolutePosition(editNode.id)
    const localX = cx - abs.x
    const localY = cy - abs.y
    if (localX < 0 || localY < 0 || localX > editNode.width || localY > editNode.height) {
      store.commitTextEdit()
      return false
    }
    if (clickCount >= 3) {
      editor.selectAll()
    } else if (clickCount === 2) {
      editor.selectWordAt(localX, localY)
    } else {
      editor.setCursorAt(localX, localY, shiftKey)
      drag.value = { type: 'text-select', startX: cx, startY: cy } as DragState
    }
    store.requestRender()
    return true
  }

  function tryStartRotation(sx: number, sy: number): boolean {
    if (store.state.selectedIds.size !== 1) return false
    const id = [...store.state.selectedIds][0]
    const node = store.graph.getNode(id)
    if (!node || node.locked) return false
    const abs = store.graph.getAbsolutePosition(id)
    if (
      !hitTestCornerRotation(
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
    )
      return false

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
    return true
  }

  function tryStartResize(sx: number, sy: number, cx: number, cy: number): boolean {
    for (const id of store.state.selectedIds) {
      const node = store.graph.getNode(id)
      if (!node || node.locked) continue
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
        return true
      }
    }
    return false
  }

  function duplicateAndDrag(
    cx: number,
    cy: number
  ): Map<string, { x: number; y: number; parentId: string }> {
    const newIds: string[] = []
    const newOriginals = new Map<string, { x: number; y: number; parentId: string }>()
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
      const newNode = store.graph.getNode(newId)
      newOriginals.set(newId, {
        x: src.x,
        y: src.y,
        parentId: newNode?.parentId ?? store.state.currentPageId
      })
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
    return newOriginals
  }

  function detectAutoLayoutParent(): string | undefined {
    if (store.state.selectedIds.size !== 1) return undefined
    const selectedId = [...store.state.selectedIds][0]
    const selectedNode = store.graph.getNode(selectedId)
    if (!selectedNode?.parentId) return undefined
    const parent = store.graph.getNode(selectedNode.parentId)
    if (parent && parent.layoutMode !== 'NONE' && selectedNode.layoutPositioning !== 'ABSOLUTE') {
      return parent.id
    }
    return undefined
  }

  function resolveHit(cx: number, cy: number): SceneNode | null {
    const titleHit =
      hitTestFrameTitle(cx, cy) ?? hitTestSectionTitle(cx, cy) ?? hitTestComponentLabel(cx, cy)
    if (titleHit) return titleHit

    const hit = hitTestInScope(cx, cy, false)
    if (hit) return hit

    const scopeId = store.state.enteredContainerId
    if (!scopeId) return null

    if (isInsideContainerBounds(cx, cy, scopeId)) {
      store.clearSelection()
      return null
    }

    store.exitContainer()
    const afterExit = hitTestInScope(cx, cy, false)
    if (afterExit) return afterExit

    if (store.state.enteredContainerId) {
      store.exitContainer()
    }
    return null
  }

  function handleSelectDown(e: MouseEvent, sx: number, sy: number, cx: number, cy: number) {
    if (store.state.editingTextId && handleTextEditClick(cx, cy, e.shiftKey)) return

    if (store.state.editingTextId) store.commitTextEdit()

    if (tryStartRotation(sx, sy)) return
    if (tryStartResize(sx, sy, cx, cy)) return

    const hit = resolveHit(cx, cy)
    if (!hit) {
      if (!store.state.enteredContainerId) {
        store.clearSelection()
        drag.value = { type: 'marquee', startX: cx, startY: cy }
      }
      return
    }

    if (!store.state.selectedIds.has(hit.id) && !e.shiftKey) {
      store.select([hit.id])
    } else if (e.shiftKey) {
      store.select([hit.id], true)
    }

    const allLocked = [...store.state.selectedIds].every((id) => store.graph.getNode(id)?.locked)
    if (allLocked) return

    const originals = new Map<string, { x: number; y: number; parentId: string }>()
    for (const id of store.state.selectedIds) {
      const n = store.graph.getNode(id)
      if (n)
        originals.set(id, { x: n.x, y: n.y, parentId: n.parentId ?? store.state.currentPageId })
    }

    if (e.altKey && store.state.selectedIds.size > 0) {
      duplicateAndDrag(cx, cy)
      return
    }

    drag.value = {
      type: 'move',
      startX: cx,
      startY: cy,
      originals,
      autoLayoutParentId: detectAutoLayoutParent()
    }
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
      startPanDrag(e)
      return
    }

    if (tool === 'SELECT' && e.altKey && !store.state.selectedIds.size) {
      startPanDrag(e)
      return
    }

    if (tool === 'SELECT') {
      handleSelectDown(e, sx, sy, cx, cy)
      return
    }

    if (tool === 'PEN') {
      store.penAddVertex(cx, cy)
      drag.value = { type: 'pen-drag', startX: cx, startY: cy } as DragState
      return
    }

    if (tool === 'TEXT') {
      const nodeId = store.createShape('TEXT', cx, cy, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT)
      store.graph.updateNode(nodeId, { text: '' })
      store.select([nodeId])
      store.startTextEditing(nodeId)
      store.setTool('SELECT')
      store.requestRender()
      return
    }

    const nodeType = TOOL_TO_NODE[tool]
    if (!nodeType) return

    const nodeId = store.createShape(nodeType, cx, cy, 0, 0)
    store.select([nodeId])

    drag.value = { type: 'draw', startX: cx, startY: cy, nodeId }
  }

  function updateHoverCursor(e: MouseEvent) {
    const { sx, sy, cx, cy } = getCoords(e)
    let cursor: string | null = null

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

    if (!cursor && store.state.selectedIds.size === 1) {
      const id = [...store.state.selectedIds][0]
      const node = store.graph.getNode(id)
      if (node) {
        const abs = store.graph.getAbsolutePosition(id)
        const corner = hitTestCornerRotation(
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
        if (corner) {
          cursor = cornerRotationCursor(corner, node.rotation)
        }
      }
    }

    cursorOverride.value = cursor

    const hit =
      hitTestSectionTitle(cx, cy) ?? hitTestComponentLabel(cx, cy) ?? hitTestInScope(cx, cy, false)
    store.setHoveredNode(hit && !store.state.selectedIds.has(hit.id) ? hit.id : null)
  }

  function handlePanMove(d: DragPan, e: MouseEvent) {
    const dx = e.clientX - d.startScreenX
    const dy = e.clientY - d.startScreenY
    store.state.panX = d.startPanX + dx
    store.state.panY = d.startPanY + dy
    store.requestRepaint()
  }

  function handleRotateMove(d: DragRotate, sx: number, sy: number, shiftKey: boolean) {
    const currentAngle = Math.atan2(sy - d.centerY, sx - d.centerX) * (180 / Math.PI)
    let rotation = d.origRotation + (currentAngle - d.startAngle)

    if (shiftKey) {
      rotation = Math.round(rotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES
    }

    rotation = ((((rotation + 180) % 360) + 360) % 360) - 180
    store.setRotationPreview({ nodeId: d.nodeId, angle: rotation })
  }

  function findDropTarget(cx: number, cy: number) {
    let dropTarget = store.graph.hitTestFrame(
      cx,
      cy,
      store.state.selectedIds,
      store.state.currentPageId
    )
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
    return dropTarget
  }

  function applyMoveSnap(d: DragMove, dx: number, dy: number): { dx: number; dy: number } {
    const selectedNodes: SceneNode[] = []
    for (const [id, orig] of d.originals) {
      const n = store.graph.getNode(id)
      if (n) {
        const abs = store.graph.getAbsolutePosition(id)
        const parentAbs = n.parentId ? store.graph.getAbsolutePosition(n.parentId) : { x: 0, y: 0 }
        selectedNodes.push({
          ...n,
          x: abs.x - parentAbs.x - n.x + orig.x + dx,
          y: abs.y - parentAbs.y - n.y + orig.y + dy
        })
      }
    }

    const bounds = computeSelectionBounds(selectedNodes)
    if (!bounds) return { dx, dy }

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
    const absBounds = {
      x: bounds.x + parentAbs.x,
      y: bounds.y + parentAbs.y,
      width: bounds.width,
      height: bounds.height
    }
    const snap = computeSnap(store.state.selectedIds, absBounds, absTargets)
    store.setSnapGuides(snap.guides)
    return { dx: dx + snap.dx, dy: dy + snap.dy }
  }

  function handleMoveMove(d: DragMove, cx: number, cy: number) {
    let dx = cx - d.startX
    let dy = cy - d.startY

    if (d.autoLayoutParentId && !d.brokeFromAutoLayout) {
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < AUTO_LAYOUT_BREAK_THRESHOLD) {
        computeAutoLayoutIndicator(d, cx, cy)
        return
      }
      d.brokeFromAutoLayout = true
      store.setLayoutInsertIndicator(null)
    }

    const dropTarget = findDropTarget(cx, cy)
    const dropParent = dropTarget ? store.graph.getNode(dropTarget.id) : null

    if (dropParent && dropParent.layoutMode !== 'NONE') {
      computeAutoLayoutIndicatorForFrame(dropParent, cx, cy)
      store.setDropTarget(dropParent.id)
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

    const snapped = applyMoveSnap(d, dx, dy)
    dx = snapped.dx
    dy = snapped.dy

    for (const [id, orig] of d.originals) {
      store.updateNode(id, { x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) })
    }

    store.setDropTarget(dropTarget?.id ?? null)
  }

  function handleTextSelectMove(cx: number, cy: number) {
    const editor = store.textEditor
    const editNode = store.state.editingTextId
      ? store.graph.getNode(store.state.editingTextId)
      : null
    if (editor && editNode) {
      const abs = store.graph.getAbsolutePosition(editNode.id)
      editor.setCursorAt(cx - abs.x, cy - abs.y, true)
      store.requestRender()
    }
  }

  function handleDrawMove(d: DragDraw, cx: number, cy: number, shiftKey: boolean) {
    let w = cx - d.startX
    let h = cy - d.startY

    if (shiftKey) {
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
  }

  function handleMarqueeMove(d: DragMarquee, cx: number, cy: number) {
    const minX = Math.min(d.startX, cx)
    const minY = Math.min(d.startY, cy)
    const maxX = Math.max(d.startX, cx)
    const maxY = Math.max(d.startY, cy)

    const scopeId = store.state.enteredContainerId
    const parentId = scopeId ?? store.state.currentPageId
    const localMin = scopeId ? canvasToLocal(minX, minY, scopeId) : { lx: minX, ly: minY }
    const localMax = scopeId ? canvasToLocal(maxX, maxY, scopeId) : { lx: maxX, ly: maxY }
    const localMinX = Math.min(localMin.lx, localMax.lx)
    const localMinY = Math.min(localMin.ly, localMax.ly)
    const localMaxX = Math.max(localMin.lx, localMax.lx)
    const localMaxY = Math.max(localMin.ly, localMax.ly)

    const hits: string[] = []
    for (const node of store.graph.getChildren(parentId)) {
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
    store.select(hits)
    store.setMarquee({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
  }

  function onMouseMove(e: MouseEvent) {
    {
      const { cx, cy } = getCoords(e)
      store.state.cursorCanvasX = cx
      store.state.cursorCanvasY = cy
      if (onCursorMove) onCursorMove(cx, cy)
    }

    if (store.state.activeTool === 'PEN' && store.state.penState && !drag.value) {
      const { cx, cy } = getCoords(e)
      store.state.penCursorX = cx
      store.state.penCursorY = cy

      const first = store.state.penState.vertices[0]
      if (store.state.penState.vertices.length > 2) {
        const dist = Math.hypot(cx - first.x, cy - first.y)
        store.penSetClosingToFirst(dist < PEN_CLOSE_THRESHOLD)
      }
      store.requestRepaint()
    }

    if (!drag.value && store.state.activeTool === 'SELECT') {
      updateHoverCursor(e)
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
      handleMoveMove(d, cx, cy)
      return
    }
    if (d.type === 'text-select') {
      handleTextSelectMove(cx, cy)
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
      handleDrawMove(d, cx, cy, e.shiftKey)
      return
    }

    handleMarqueeMove(d, cx, cy)
  }

  function constrainToAspectRatio(
    handle: HandlePosition,
    origRect: Rect,
    width: number,
    height: number,
    dx: number,
    dy: number
  ): Rect {
    let x = handle.includes('w') ? origRect.x + origRect.width - Math.abs(width) : origRect.x
    const isTop = handle === 'nw' || handle === 'n' || handle === 'ne'
    let y = isTop ? origRect.y + origRect.height - Math.abs(height) : origRect.y
    const aspect = origRect.width / origRect.height

    if (handle === 'n' || handle === 's') {
      width = Math.abs(height) * aspect
      x = origRect.x + (origRect.width - width) / 2
    } else if (handle === 'e' || handle === 'w') {
      height = Math.abs(width) / aspect
      y = origRect.y + (origRect.height - height) / 2
    } else if (Math.abs(dx) > Math.abs(dy)) {
      height = (Math.abs(width) / aspect) * Math.sign(height || 1)
      if (isTop) y = origRect.y + origRect.height - Math.abs(height)
    } else {
      width = Math.abs(height) * aspect * Math.sign(width || 1)
      if (handle.includes('w')) x = origRect.x + origRect.width - Math.abs(width)
    }

    return { x, y, width, height }
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
      ;({ x, y, width, height } = constrainToAspectRatio(handle, origRect, width, height, dx, dy))
    }

    if (width < 0) {
      x += width
      width = -width
    }
    if (height < 0) {
      y += height
      height = -height
    }

    store.updateNode(d.nodeId, {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.max(1, width)),
      height: Math.round(Math.max(1, height))
    })
  }

  function handleMoveUp(d: DragMove) {
    const indicator = store.state.layoutInsertIndicator
    store.setLayoutInsertIndicator(null)
    store.setSnapGuides([])

    if (indicator) {
      for (const id of store.state.selectedIds) {
        store.reorderInAutoLayout(id, indicator.parentId, indicator.index)
      }
      store.setDropTarget(null)
      return
    }

    const moved = [...d.originals].some(([id, orig]) => {
      const node = store.graph.getNode(id)
      return node && (node.x !== orig.x || node.y !== orig.y)
    })

    if (moved) {
      const dropId = store.state.dropTargetId
      if (dropId) {
        store.reparentNodes([...store.state.selectedIds], dropId)
      } else {
        reparentOutsideNodes()
      }
      store.commitMoveWithReparent(d.originals)
    }
    store.setDropTarget(null)
  }

  function reparentOutsideNodes() {
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

  function handleDrawUp(d: DragDraw) {
    const node = store.graph.getNode(d.nodeId)
    if (node && node.width < 2 && node.height < 2) {
      store.updateNode(d.nodeId, { width: 100, height: 100 })
    }
    if (node?.type === 'SECTION') {
      store.adoptNodesIntoSection(node.id)
    }
    store.setTool('SELECT')
  }

  function onMouseUp() {
    if (!drag.value) return
    const d = drag.value

    if (d.type === 'move') handleMoveUp(d)
    else if (d.type === 'text-select') {
      drag.value = null
      return
    } else if (d.type === 'resize') store.commitResize(d.nodeId, d.origRect)
    else if (d.type === 'pen-drag') {
      drag.value = null
      return
    } else if (d.type === 'rotate') {
      const preview = store.state.rotationPreview
      if (preview) {
        store.updateNode(d.nodeId, { rotation: preview.angle })
        store.commitRotation(d.nodeId, d.origRotation)
      }
      store.setRotationPreview(null)
    } else if (d.type === 'draw') handleDrawUp(d)
    else if (d.type === 'marquee') store.setMarquee(null)

    drag.value = null
    cursorOverride.value = null
  }

  const wheelAccum = {
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

    const selectedId =
      store.state.selectedIds.size === 1 ? [...store.state.selectedIds][0] : undefined
    const selectedNode = selectedId ? store.graph.getNode(selectedId) : undefined
    const canEnter =
      selectedNode && selectedId && store.graph.isContainer(selectedId) && !selectedNode.locked

    if (canEnter) {
      store.enterContainer(selectedId)
      const useDeep = selectedNode.type === 'COMPONENT' || selectedNode.type === 'INSTANCE'
      const hit = hitTestInScope(cx, cy, useDeep)
      if (hit) {
        store.select([hit.id])
      } else {
        store.clearSelection()
      }
      return
    }

    const hit =
      hitTestSectionTitle(cx, cy) ?? hitTestComponentLabel(cx, cy) ?? hitTestInScope(cx, cy, true)
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

  function computeIndicatorPosition(
    children: SceneNode[],
    insertIndex: number,
    parent: SceneNode,
    parentAbs: Vector,
    isRow: boolean
  ): number {
    if (children.length === 0) {
      return isRow ? parentAbs.x + parent.paddingLeft : parentAbs.y + parent.paddingTop
    }
    if (insertIndex === 0) {
      const firstAbs = store.graph.getAbsolutePosition(children[0].id)
      return (isRow ? firstAbs.x : firstAbs.y) - parent.itemSpacing / 2
    }
    if (insertIndex >= children.length) {
      const last = children[children.length - 1]
      const lastAbs = store.graph.getAbsolutePosition(last.id)
      return isRow
        ? lastAbs.x + last.width + parent.itemSpacing / 2
        : lastAbs.y + last.height + parent.itemSpacing / 2
    }
    const prev = children[insertIndex - 1]
    const next = children[insertIndex]
    const prevAbs = store.graph.getAbsolutePosition(prev.id)
    const nextAbs = store.graph.getAbsolutePosition(next.id)
    return isRow
      ? (prevAbs.x + prev.width + nextAbs.x) / 2
      : (prevAbs.y + prev.height + nextAbs.y) / 2
  }

  function filteredToRealIndex(parentId: string, insertIndex: number): number {
    const allChildren = store.graph.getChildren(parentId)
    let realIndex = 0
    let filteredCount = 0
    for (const child of allChildren) {
      if (store.state.selectedIds.has(child.id)) continue
      if (child.layoutPositioning === 'ABSOLUTE') {
        realIndex++
        continue
      }
      if (filteredCount === insertIndex) break
      filteredCount++
      realIndex++
    }
    return realIndex
  }

  function computeAutoLayoutIndicatorForFrame(parent: SceneNode, cx: number, cy: number) {
    const children = store.graph
      .getChildren(parent.id)
      .filter((c) => c.layoutPositioning !== 'ABSOLUTE' && !store.state.selectedIds.has(c.id))

    const parentAbs = store.graph.getAbsolutePosition(parent.id)
    const isRow = parent.layoutMode === 'HORIZONTAL'

    let insertIndex = children.length
    for (let i = 0; i < children.length; i++) {
      const childAbs = store.graph.getAbsolutePosition(children[i].id)
      const mid = isRow ? childAbs.x + children[i].width / 2 : childAbs.y + children[i].height / 2
      if ((isRow ? cx : cy) < mid) {
        insertIndex = i
        break
      }
    }

    const indicatorPos = computeIndicatorPosition(children, insertIndex, parent, parentAbs, isRow)
    const crossStart = isRow ? parentAbs.y + parent.paddingTop : parentAbs.x + parent.paddingLeft
    const crossLength = isRow
      ? parent.height - parent.paddingTop - parent.paddingBottom
      : parent.width - parent.paddingLeft - parent.paddingRight

    store.setLayoutInsertIndicator({
      parentId: parent.id,
      index: filteredToRealIndex(parent.id, insertIndex),
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
    if (!drag.value) {
      store.setHoveredNode(null)
    }
  })
  useEventListener(window, 'mouseup', () => {
    if (drag.value) onMouseUp()
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
        sx: ge.clientX - rect.left,
        sy: ge.clientY - rect.top
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
