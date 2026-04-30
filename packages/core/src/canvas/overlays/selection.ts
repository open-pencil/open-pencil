import { getWorldMatrix } from '#core/canvas/coordinate'
import Matrix from '#core/canvas/matrix'
import { HANDLE_HALF_SIZE, SELECTION_DASH_ALPHA } from '#core/constants'
import { rotatedCorners } from '#core/geometry'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import type { SceneGraph, SceneNode } from '#core/scene-graph'
import type { Vector } from '#core/types'
import type { Canvas } from 'canvaskit-wasm'

function getNodeTransformChain(graph: SceneGraph, node: SceneNode): SceneNode[] {
  const chain: SceneNode[] = []
  let current = node

  for (;;) {
    chain.unshift(current)
    if (!current.parentId) break
    const parent = graph.getNode(current.parentId)
    if (!parent || parent.id === graph.rootId || parent.type === 'CANVAS') break
    current = parent
  }

  return chain
}

export function drawHoverHighlight(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  hoveredNodeId?: string | null
): void {
  if (!hoveredNodeId) return
  const node = graph.getNode(hoveredNodeId)
  if (!node) return

  r.auxStroke.setStrokeWidth(1 / r.zoom)
  r.auxStroke.setColor(r.isComponentType(node.type) ? r.compColor() : r.selColor())
  r.auxStroke.setPathEffect(null)

  const chain = getNodeTransformChain(graph, node)

  canvas.save()
  canvas.translate(r.panX, r.panY)
  canvas.scale(r.zoom, r.zoom)

  for (const item of chain) {
    canvas.translate(item.x, item.y)
    if (item.rotation !== 0) {
      canvas.rotate(item.rotation, item.width / 2, item.height / 2)
    }
  }

  r.strokeNodeShape(canvas, node, r.auxStroke)
  canvas.restore()
}

export function drawEnteredContainer(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  enteredContainerId?: string | null
): void {
  if (!enteredContainerId) return
  const node = graph.getNode(enteredContainerId)
  if (!node) return

  const abs = graph.getAbsolutePosition(node.id)
  const sx = abs.x * r.zoom + r.panX
  const sy = abs.y * r.zoom + r.panY

  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(r.selColor(SELECTION_DASH_ALPHA))
  r.auxStroke.setPathEffect(r.ck.PathEffect.MakeDash([4, 4], 0))

  canvas.save()
  canvas.translate(sx, sy)
  if (node.rotation !== 0) {
    const cx = (node.width / 2) * r.zoom
    const cy = (node.height / 2) * r.zoom
    canvas.rotate(node.rotation, cx, cy)
  }
  canvas.drawRect(r.ck.LTRBRect(0, 0, node.width * r.zoom, node.height * r.zoom), r.auxStroke)
  canvas.restore()

  r.auxStroke.setPathEffect(null)
}

export function drawSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  if (selectedIds.size === 0) return
  const nodeEditId = overlays.nodeEditState?.nodeId ?? null

  r.drawParentFrameOutlines(canvas, graph, selectedIds)

  if (selectedIds.size === 1) {
    const id = [...selectedIds][0]
    if (overlays.editingTextId === id) return
    if (nodeEditId === id) return
    const node = graph.getNode(id)
    if (!node) return

    const useComponentColor = r.isComponentType(node.type)
    r.selectionPaint.setColor(useComponentColor ? r.compColor() : r.selColor())
    r.selectionPaint.setStrokeWidth(1 / r.zoom)

    const rotation =
      overlays.rotationPreview?.nodeId === id ? overlays.rotationPreview.angle : node.rotation
    r.drawNodeSelection(canvas, node, rotation, graph)
    r.drawSelectionLabels(canvas, graph, selectedIds, overlays)

    r.selectionPaint.setColor(r.selColor())
    return
  }

  for (const id of selectedIds) {
    if (nodeEditId === id) continue
    const node = graph.getNode(id)
    if (!node) continue

    const useComponentColor = r.isComponentType(node.type)
    r.selectionPaint.setColor(useComponentColor ? r.compColor() : r.selColor())
    r.selectionPaint.setStrokeWidth(1)

    const rotation =
      overlays.rotationPreview?.nodeId === id ? overlays.rotationPreview.angle : node.rotation
    r.drawNodeOutline(canvas, node, rotation, graph)
  }

  r.selectionPaint.setColor(r.selColor())

  const nodes = [...selectedIds]
    .filter((id) => id !== nodeEditId)
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined)
  if (nodes.length === 0) return
  r.drawGroupBounds(canvas, nodes, graph)

  r.drawSelectionLabels(canvas, graph, selectedIds, overlays)
}

function withNodeBounds(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph,
  draw: (x1: number, y1: number, x2: number, y2: number) => void
): void {
  const worldMatrix = getWorldMatrix({ ...node, rotation }, graph)

  canvas.save()
  canvas.translate(r.panX, r.panY)
  canvas.scale(r.zoom, r.zoom)
  canvas.concat(worldMatrix)
  draw(0, 0, node.width, node.height)

  canvas.restore()
}

function drawBoundsHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): void {
  r.drawHandle(canvas, minX, minY)
  r.drawHandle(canvas, maxX, minY)
  r.drawHandle(canvas, minX, maxY)
  r.drawHandle(canvas, maxX, maxY)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const rotationHandleY = minY - 24 / r.zoom
  canvas.drawLine(midX, minY, midX, rotationHandleY, r.selectionPaint)
  r.drawHandle(canvas, midX, rotationHandleY)
  r.drawHandle(canvas, midX, minY)
  r.drawHandle(canvas, midX, maxY)
  r.drawHandle(canvas, minX, midY)
  r.drawHandle(canvas, maxX, midY)
}

function drawSelectionRect(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph,
  afterDraw?: (x1: number, y1: number, x2: number, y2: number) => void
): void {
  withNodeBounds(r, canvas, node, rotation, graph, (x1, y1, x2, y2) => {
    canvas.drawRect(r.ck.LTRBRect(x1, y1, x2, y2), r.selectionPaint)
    afterDraw?.(x1, y1, x2, y2)
  })
}

export function drawNodeSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph
): void {
  drawSelectionRect(r, canvas, node, rotation, graph, (x1, y1, x2, y2) => {
    drawBoundsHandles(r, canvas, x1, y1, x2, y2)
  })
}

export function drawParentFrameOutlines(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>
): void {
  const drawn = new Set<string>()
  for (const id of selectedIds) {
    const node = graph.getNode(id)
    if (!node?.parentId) continue

    const parent = graph.getNode(node.parentId)
    if (!parent || parent.type === 'CANVAS') continue
    if (drawn.has(parent.id) || selectedIds.has(parent.id)) continue

    const grandparent = parent.parentId ? graph.getNode(parent.parentId) : null
    if (!grandparent || grandparent.type === 'CANVAS') continue

    drawn.add(parent.id)

    const world = getWorldMatrix(parent, graph)
    const view = Matrix.multiply(Matrix.translated(r.panX, r.panY), Matrix.scaled(r.zoom, r.zoom))
    const m = Matrix.multiply(view, world)

    const pts = Matrix.mapPoints(m, [
      0,
      0,
      parent.width,
      0,
      parent.width,
      parent.height,
      0,
      parent.height
    ])

    const path = new r.ck.Path()
    path.moveTo(pts[0], pts[1])
    path.lineTo(pts[2], pts[3])
    path.lineTo(pts[4], pts[5])
    path.lineTo(pts[6], pts[7])
    path.close()

    canvas.drawPath(path, r.parentOutlinePaint)
  }
}

export function drawNodeOutline(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph
): void {
  drawSelectionRect(r, canvas, node, rotation, graph)
}

export function drawGroupBounds(
  r: SkiaRenderer,
  canvas: Canvas,
  nodes: SceneNode[],
  graph: SceneGraph
): void {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    const abs = graph.getAbsolutePosition(n.id)
    if (n.rotation !== 0) {
      const corners = r.getRotatedCorners(n, abs)
      for (const c of corners) {
        minX = Math.min(minX, c.x)
        minY = Math.min(minY, c.y)
        maxX = Math.max(maxX, c.x)
        maxY = Math.max(maxY, c.y)
      }
    } else {
      const x1 = abs.x * r.zoom + r.panX
      const y1 = abs.y * r.zoom + r.panY
      const x2 = (abs.x + n.width) * r.zoom + r.panX
      const y2 = (abs.y + n.height) * r.zoom + r.panY
      minX = Math.min(minX, x1)
      minY = Math.min(minY, y1)
      maxX = Math.max(maxX, x2)
      maxY = Math.max(maxY, y2)
    }
  }

  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(r.selColor(SELECTION_DASH_ALPHA))
  r.auxStroke.setPathEffect(null)

  canvas.drawRect(r.ck.LTRBRect(minX, minY, maxX, maxY), r.auxStroke)

  drawBoundsHandles(r, canvas, minX, minY, maxX, maxY)
}

export function getRotatedCorners(r: SkiaRenderer, n: SceneNode, abs: Vector): Vector[] {
  const cx = (abs.x + n.width / 2) * r.zoom + r.panX
  const cy = (abs.y + n.height / 2) * r.zoom + r.panY
  const hw = (n.width / 2) * r.zoom
  const hh = (n.height / 2) * r.zoom
  return rotatedCorners(cx, cy, hw, hh, n.rotation)
}

export function drawHandle(r: SkiaRenderer, canvas: Canvas, x: number, y: number): void {
  r.auxFill.setColor(r.ck.WHITE)
  const rect = r.ck.LTRBRect(
    x - HANDLE_HALF_SIZE / r.zoom,
    y - HANDLE_HALF_SIZE / r.zoom,
    x + HANDLE_HALF_SIZE / r.zoom,
    y + HANDLE_HALF_SIZE / r.zoom
  )
  canvas.drawRect(rect, r.auxFill)
  canvas.drawRect(rect, r.selectionPaint)
}
