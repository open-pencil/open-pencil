import {
  LABEL_OFFSET_Y,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y
} from '../constants'
import { degToRad, rotatePoint, rotatedCorners } from '../geometry'

import type { SceneNode, SceneGraph } from '../scene-graph'
import type { SkiaRenderer, RenderOverlays } from './renderer'
import type { Canvas } from 'canvaskit-wasm'

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
    const abs = graph.getAbsolutePosition(id)
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

  const abs = graph.getAbsolutePosition(node.id)
  const rotation = getOverlayRotation(node, overlays)
  const anchor =
    rotation === 0
      ? { x: abs.x, y: abs.y }
      : rotatePoint(
          abs.x,
          abs.y,
          abs.x + node.width / 2,
          abs.y + node.height / 2,
          degToRad(rotation)
        )
  const labelX = anchor.x * r.zoom + r.panX
  const labelY = anchor.y * r.zoom + r.panY - LABEL_OFFSET_Y

  r.auxFill.setColor(r.selColor())
  canvas.save()
  canvas.translate(labelX, labelY)
  if (rotation !== 0) {
    canvas.rotate(rotation, 0, LABEL_OFFSET_Y)
  }
  canvas.drawText(node.name, 0, 0, r.auxFill, labelFont)
  canvas.restore()
}

function drawSingleSelectionSize(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays,
  sizeFont: NonNullable<SkiaRenderer['sizeFont']>
): void {
  const sizeText = `${Math.round(node.width)} × ${Math.round(node.height)}`
  const glyphIds = sizeFont.getGlyphIDs(sizeText)
  const widths = sizeFont.getGlyphWidths(glyphIds)
  let textWidth = 0
  for (const width of widths) textWidth += width
  const pillW = textWidth + SIZE_PILL_PADDING_X * 2
  const pillH = SIZE_PILL_HEIGHT
  const pillColor = r.isComponentType(node.type) ? r.compColor() : r.selColor()
  const abs = graph.getAbsolutePosition(node.id)
  const rotation = getOverlayRotation(node, overlays)
  const cx = (abs.x + node.width / 2) * r.zoom + r.panX
  const cy = (abs.y + node.height / 2) * r.zoom + r.panY
  const localY = (node.height * r.zoom) / 2 + SIZE_PILL_PADDING_Y

  canvas.save()
  canvas.translate(cx, cy)
  if (rotation !== 0) {
    canvas.rotate(rotation, 0, 0)
  }

  r.auxFill.setColor(pillColor)
  const rrect = r.ck.RRectXY(
    r.ck.LTRBRect(-pillW / 2, localY, pillW / 2, localY + pillH),
    SIZE_PILL_RADIUS,
    SIZE_PILL_RADIUS
  )
  canvas.drawRRect(rrect, r.auxFill)

  r.auxFill.setColor(r.ck.WHITE)
  canvas.drawText(
    sizeText,
    -pillW / 2 + SIZE_PILL_PADDING_X,
    localY + SIZE_PILL_TEXT_OFFSET_Y,
    r.auxFill,
    sizeFont
  )
  canvas.restore()
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
  const glyphIds = sizeFont.getGlyphIDs(sizeText)
  const widths = sizeFont.getGlyphWidths(glyphIds)
  let textWidth = 0
  for (const width of widths) textWidth += width
  const pillW = textWidth + SIZE_PILL_PADDING_X * 2
  const pillH = SIZE_PILL_HEIGHT
  const sx1 = minX * r.zoom + r.panX
  const sx2 = maxX * r.zoom + r.panX
  const sy2 = maxY * r.zoom + r.panY
  const smx = (sx1 + sx2) / 2
  const pillX = smx - pillW / 2
  const pillY = sy2 + SIZE_PILL_PADDING_Y
  const allComponents = nodes.length > 0 && nodes.every((n) => r.isComponentType(n.type))
  const pillColor = allComponents ? r.compColor() : r.selColor()

  r.auxFill.setColor(pillColor)
  const rrect = r.ck.RRectXY(
    r.ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + pillH),
    SIZE_PILL_RADIUS,
    SIZE_PILL_RADIUS
  )
  canvas.drawRRect(rrect, r.auxFill)

  r.auxFill.setColor(r.ck.WHITE)
  canvas.drawText(
    sizeText,
    pillX + SIZE_PILL_PADDING_X,
    pillY + SIZE_PILL_TEXT_OFFSET_Y,
    r.auxFill,
    sizeFont
  )
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
