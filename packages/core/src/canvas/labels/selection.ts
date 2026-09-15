import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode, SceneGraph } from '@open-pencil/scene-graph'
import { computeBounds } from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer, RenderOverlays } from '#core/canvas/renderer'
import {
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y
} from '#core/constants'
import { createSceneGeometry } from '#core/geometry'

import { hasFrameTitle, labelLayout } from './layout'
import { measureGlyphWidth } from './paragraph-cache'
import { frameLabelPlacement, labelScreenMatrix } from './transform'

function accumulateSelectionBounds(
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays?: RenderOverlays
): { nodes: SceneNode[]; minX: number; minY: number; maxX: number; maxY: number } {
  const nodes = [...selectedIds]
    .map((id) => graph.getNode(id))
    .filter((node): node is SceneNode => node !== undefined)
  const geometry = createSceneGeometry(graph, overlays?.rotationPreview)
  const bounds = computeBounds(nodes.map(geometry.bounds))
  return {
    nodes,
    minX: bounds.x,
    minY: bounds.y,
    maxX: bounds.x + bounds.width,
    maxY: bounds.y + bounds.height
  }
}

function drawSingleFrameTitle(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays
): void {
  const parentNode = node.parentId ? graph.getNode(node.parentId) : null
  const provider = r.fontProvider
  if (!hasFrameTitle(node, parentNode) || !provider) return

  const transform = frameLabelPlacement(node, graph, overlays.rotationPreview)

  r.auxFill.setColor(r.selColor())

  const layout = labelLayout('frame', transform.width * r.zoom)
  if (!layout) return

  canvas.save()
  canvas.concat(labelScreenMatrix(transform, r))

  r.labelParagraphCache.draw(
    r.ck,
    canvas,
    provider,
    node.name,
    layout.fontSize,
    layout.maxTextWidth,
    r.selColor(),
    r.fontGeneration,
    layout.text.x,
    layout.text.y,
    layout.fontWeight
  )
  canvas.restore()
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
  const pillW = measureGlyphWidth(sizeFont, text) + SIZE_PILL_PADDING_X * 2
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
  const transform = frameLabelPlacement(node, graph, overlays.rotationPreview, {
    x: 0.5,
    y: 1
  })

  // Keep the label's typography and gap in screen pixels rather than scaling them.
  canvas.save()
  canvas.concat(labelScreenMatrix(transform, r))

  drawSizePill(r, canvas, sizeFont, sizeText, 0, 0, pillColor)
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
    drawSingleFrameTitle(r, canvas, graph, nodes[0], activeOverlays)
    drawSingleSelectionSize(r, canvas, graph, nodes[0], activeOverlays, sizeFont)
    return
  }

  drawMultiSelectionSize(r, canvas, nodes, minX, minY, maxX, maxY, sizeFont)
}
