import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneNode, SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer, RenderOverlays } from '#core/canvas/renderer'
import {
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y
} from '#core/constants'
import {
  createSceneGeometry,
  hasTransformHandles,
  panelNumber,
  selectionBounds
} from '#core/geometry'
import { worldXToScreen, worldYToScreen } from '#core/geometry/viewport'

import { drawTextPill } from './pill'
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
  const bounds = selectionBounds(geometry, nodes)
  return {
    nodes,
    minX: bounds.x,
    minY: bounds.y,
    maxX: bounds.x + bounds.width,
    maxY: bounds.y + bounds.height
  }
}

function drawSizePill(
  r: SkiaRenderer,
  canvas: Canvas,
  sizeFont: NonNullable<SkiaRenderer['chromeFonts']['size']>,
  text: string,
  x: number,
  y: number,
  color: ReturnType<SkiaRenderer['selColor']>,
  textColor: ReturnType<SkiaRenderer['selColor']>
): void {
  drawTextPill(r, canvas, {
    text,
    font: sizeFont,
    centerX: x,
    top: y + SIZE_PILL_PADDING_Y,
    height: SIZE_PILL_HEIGHT,
    paddingX: SIZE_PILL_PADDING_X,
    radius: SIZE_PILL_RADIUS,
    baseline: SIZE_PILL_TEXT_OFFSET_Y,
    fill: color,
    textColor
  })
}

export function drawSingleSelectionSize(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays,
  sizeFont: NonNullable<SkiaRenderer['chromeFonts']['size']>
): void {
  const sizeText = `${panelNumber(node.width)} × ${panelNumber(node.height)}`
  const pillColor = r.outlineColor(node, graph)
  const transform = frameLabelPlacement(node, graph, overlays.rotationPreview, {
    x: 0.5,
    y: 1
  })

  // Keep the label's typography and gap in screen pixels rather than scaling them.
  canvas.save()
  canvas.concat(labelScreenMatrix(transform, r))

  const textColor = r.outlineForegroundColor(node, graph)
  drawSizePill(r, canvas, sizeFont, sizeText, 0, 0, pillColor, textColor)
  canvas.restore()
}
function drawMultiSelectionSize(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodes: SceneNode[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  sizeFont: NonNullable<SkiaRenderer['chromeFonts']['size']>
): void {
  const sizeText = `${panelNumber(maxX - minX)} × ${panelNumber(maxY - minY)}`
  const sx1 = worldXToScreen(r, minX)
  const sx2 = worldXToScreen(r, maxX)
  const sy2 = worldYToScreen(r, maxY)
  const smx = (sx1 + sx2) / 2
  const allComponents = nodes.length > 0 && nodes.every((n) => r.isInComponent(n, graph))
  const pillColor = allComponents ? r.compColor() : r.selColor()
  const textColor = allComponents ? r.ck.WHITE : r.selForegroundColor()

  drawSizePill(r, canvas, sizeFont, sizeText, smx, sy2, pillColor, textColor)
}

export function drawSelectionLabels(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays?: RenderOverlays
): void {
  const labelFont = r.chromeFonts.label
  const sizeFont = r.chromeFonts.size
  if (!labelFont || !sizeFont) return
  const activeOverlays = overlays ?? {}
  if (activeOverlays.showSizeLabels === false) return
  const { nodes, minX, minY, maxX, maxY } = accumulateSelectionBounds(
    graph,
    selectedIds,
    activeOverlays
  )
  if (nodes.length === 0) return
  // A selection too small on screen for handles has no size label either, as in Figma.
  const [only] = nodes
  const width = nodes.length === 1 ? only.width : maxX - minX
  const height = nodes.length === 1 ? only.height : maxY - minY
  if (!hasTransformHandles(width * r.zoom, height * r.zoom)) return

  if (nodes.length === 1) {
    drawSingleSelectionSize(r, canvas, graph, nodes[0], activeOverlays, sizeFont)
    return
  }

  drawMultiSelectionSize(r, canvas, graph, nodes, minX, minY, maxX, maxY, sizeFont)
}
