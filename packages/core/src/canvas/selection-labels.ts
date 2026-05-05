import type { Canvas } from 'canvaskit-wasm'

import { getAbsolutePosition, getWorldMatrix } from '#core/canvas/coordinate'
import {
  LABEL_OFFSET_Y,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y
} from '#core/constants'
import { rotatedCorners } from '#core/geometry'
import type { SceneNode, SceneGraph } from '#core/scene-graph'

import type { SkiaRenderer, RenderOverlays } from './renderer'

function getOverlayRotation(node: SceneNode, overlays?: RenderOverlays): number {
  return overlays?.rotationPreview?.nodeId === node.id
    ? overlays.rotationPreview.angle
    : node.rotation
}

function accumulateSelectionBounds(
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays?: RenderOverlays
): { nodes: SceneNode[]; minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const nodes: SceneNode[] = []

  for (const id of selectedIds) {
    const node = graph.getNode(id)
    if (!node) continue
    nodes.push(node)
    const abs = getAbsolutePosition(node, graph)
    const rotation = getOverlayRotation(node, overlays)
    if (rotation !== 0) {
      const corners = rotatedCorners(abs.x, abs.y, node.width, node.height, rotation)
      for (const corner of corners) {
        minX = Math.min(minX, corner.x)
        minY = Math.min(minY, corner.y)
        maxX = Math.max(maxX, corner.x)
        maxY = Math.max(maxY, corner.y)
      }
      continue
    }
    minX = Math.min(minX, abs.x)
    minY = Math.min(minY, abs.y)
    maxX = Math.max(maxX, abs.x + node.width)
    maxY = Math.max(maxY, abs.y + node.height)
  }

  return { nodes, minX, minY, maxX, maxY }
}

function drawSingleFrameTitle(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays,
  labelFont: NonNullable<SkiaRenderer['labelFont']>
): void {
  const parentNode = node.parentId ? graph.getNode(node.parentId) : null
  const isTopLevel = !parentNode || parentNode.type === 'CANVAS' || parentNode.type === 'SECTION'
  if (node.type !== 'FRAME' || !isTopLevel) return

  const overlayRotation = getOverlayRotation(node, overlays) // degrees

  const world = getWorldMatrix({ ...node, rotation: overlayRotation }, graph)

  // World -> screen (pan + zoom)
  const view = r.ck.Matrix.multiply(
    r.ck.Matrix.translated(r.panX, r.panY),
    r.ck.Matrix.scaled(r.zoom, r.zoom)
  )

  const m = r.ck.Matrix.multiply(view, world)

  r.auxFill.setColor(r.selColor())

  canvas.save()
  canvas.concat(m)

  // After concat(m), local (0,0) is node's top-left in screen space (after rotation etc.)
  canvas.drawText(node.name, 0, -LABEL_OFFSET_Y, r.auxFill, labelFont)

  canvas.restore()
}

function measureTextWidth(sizeFont: NonNullable<SkiaRenderer['sizeFont']>, text: string): number {
  const glyphIds = sizeFont.getGlyphIDs(text)
  const widths = sizeFont.getGlyphWidths(glyphIds)
  let textWidth = 0
  for (const width of widths) textWidth += width
  return textWidth
}

function drawSizePill(
  r: SkiaRenderer,
  canvas: Canvas,
  sizeFont: NonNullable<SkiaRenderer['sizeFont']>,
  text: string,
  x: number,
  y: number,
  color: ReturnType<SkiaRenderer['selColor']>
): void {
  const pillW = measureTextWidth(sizeFont, text) + SIZE_PILL_PADDING_X * 2
  const pillX = x - pillW / 2
  const pillY = y + SIZE_PILL_PADDING_Y
  r.auxFill.setColor(color)
  const rrect = r.ck.RRectXY(
    r.ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + SIZE_PILL_HEIGHT),
    SIZE_PILL_RADIUS,
    SIZE_PILL_RADIUS
  )
  canvas.drawRRect(rrect, r.auxFill)

  r.auxFill.setColor(r.ck.WHITE)
  canvas.drawText(
    text,
    pillX + SIZE_PILL_PADDING_X,
    pillY + SIZE_PILL_TEXT_OFFSET_Y,
    r.auxFill,
    sizeFont
  )
}

export function drawSingleSelectionSize(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays,
  sizeFont: NonNullable<SkiaRenderer['sizeFont']>
): void {
  const sizeText = `${Math.round(node.width)} × ${Math.round(node.height)}`
  const pillColor = r.isComponentType(node.type) ? r.compColor() : r.selColor()
  const overlayRotation = getOverlayRotation(node, overlays)

  const abs = getAbsolutePosition(node, graph)
  const cx = abs.x + node.width / 2
  const cy = abs.y + node.height / 2

  // Account for rotation: find the bottom center in canvas space
  const rad = (overlayRotation * Math.PI) / 180
  const hh = node.height / 2
  const bottomCenterX = cx + Math.sin(rad) * hh
  const bottomCenterY = cy + Math.cos(rad) * hh

  // Convert to screen space
  const sx = bottomCenterX * r.zoom + r.panX
  const sy = bottomCenterY * r.zoom + r.panY

  drawSizePill(r, canvas, sizeFont, sizeText, sx, sy, pillColor)
}
function drawMultiSelectionSize(
  r: SkiaRenderer,
  canvas: Canvas,
  nodes: SceneNode[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  sizeFont: NonNullable<SkiaRenderer['sizeFont']>
): void {
  const sizeText = `${Math.round(maxX - minX)} × ${Math.round(maxY - minY)}`
  const sx1 = minX * r.zoom + r.panX
  const sx2 = maxX * r.zoom + r.panX
  const sy2 = maxY * r.zoom + r.panY
  const smx = (sx1 + sx2) / 2
  const allComponents = nodes.length > 0 && nodes.every((n) => r.isComponentType(n.type))
  const pillColor = allComponents ? r.compColor() : r.selColor()

  drawSizePill(r, canvas, sizeFont, sizeText, smx, sy2, pillColor)
}

export function drawSelectionLabels(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays?: RenderOverlays
): void {
  const labelFont = r.labelFont
  const sizeFont = r.sizeFont
  if (!labelFont || !sizeFont) return
  const activeOverlays = overlays ?? {}
  const { nodes, minX, minY, maxX, maxY } = accumulateSelectionBounds(
    graph,
    selectedIds,
    activeOverlays
  )
  if (nodes.length === 0) return

  if (nodes.length === 1) {
    drawSingleFrameTitle(r, canvas, graph, nodes[0], activeOverlays, labelFont)
    drawSingleSelectionSize(r, canvas, graph, nodes[0], activeOverlays, sizeFont)
    return
  }

  drawMultiSelectionSize(r, canvas, nodes, minX, minY, maxX, maxY, sizeFont)
}
