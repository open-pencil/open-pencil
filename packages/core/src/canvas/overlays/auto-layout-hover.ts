import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { cachedGlyphWidth } from '#core/canvas/labels/paragraph-cache'
import { strokeLayoutChildren } from '#core/canvas/overlays/layout-outlines'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import {
  AUTO_LAYOUT_HOVER_BLUE,
  AUTO_LAYOUT_HOVER_BLUE_FILL,
  AUTO_LAYOUT_HOVER_MAGENTA,
  AUTO_LAYOUT_HOVER_MAGENTA_FILL,
  AUTO_LAYOUT_HOVER_STRIPE_GAP,
  AUTO_LAYOUT_HOVER_STRIPE_WIDTH,
  AUTO_LAYOUT_HOVER_STROKE_WIDTH,
  AUTO_LAYOUT_HOVER_TICK_LENGTH,
  AUTO_LAYOUT_HOVER_VALUE_OFFSET,
  AUTO_LAYOUT_HOVER_GAP_PILL,
  AUTO_LAYOUT_HOVER_PADDING_PILL,
  AUTO_LAYOUT_HOVER_VALUE_PILL_HEIGHT,
  AUTO_LAYOUT_HOVER_VALUE_PILL_PADDING_X,
  AUTO_LAYOUT_HOVER_VALUE_PILL_RADIUS
} from '#core/constants'
import type { RotationPreview, SceneGeometry } from '#core/geometry'
import {
  flowGaps,
  PADDING_SIDES,
  paddingOf,
  paddingRect,
  paddingTick,
  type PaddingSide
} from '#core/layout/spacing-marks'

import { inNodeSpace } from './outline'

function canvasColor(r: SkiaRenderer, color: Color) {
  return r.ck.Color4f(color.r, color.g, color.b, color.a)
}

/** The shared stroke at a width that stays the same on screen, drawn in the frame's space. */
function setStroke(r: SkiaRenderer, color: Color, width: number) {
  r.auxStroke.setStrokeWidth(width / r.zoom)
  r.auxStroke.setColor(canvasColor(r, color))
  r.auxStroke.setPathEffect(null)
}

/** A tick across `along`: a line through `at` that runs the other way, a fixed length on screen. */
function drawTick(r: SkiaRenderer, canvas: Canvas, at: Vector, along: 'x' | 'y') {
  const half = AUTO_LAYOUT_HOVER_TICK_LENGTH / r.zoom
  if (along === 'x') canvas.drawLine(at.x - half, at.y, at.x + half, at.y, r.auxStroke)
  else canvas.drawLine(at.x, at.y - half, at.x, at.y + half, r.auxStroke)
}

function drawStripedRect(r: SkiaRenderer, canvas: Canvas, rect: Rect, color: Color, fill: Color) {
  const { x, y, width, height } = rect
  if (width <= 0 || height <= 0) return
  const box = r.ck.LTRBRect(x, y, x + width, y + height)
  r.auxFill.setColor(canvasColor(r, fill))
  canvas.drawRect(box, r.auxFill)

  const path = new r.ck.PathBuilder()
  const gap = AUTO_LAYOUT_HOVER_STRIPE_GAP / r.zoom
  for (let sx = x - height; sx < x + width; sx += gap) {
    path.moveTo(sx, y + height)
    path.lineTo(sx + height, y)
  }
  setStroke(r, color, AUTO_LAYOUT_HOVER_STRIPE_WIDTH)
  canvas.save()
  canvas.clipRect(box, r.ck.ClipOp.Intersect, true)
  const stripes = path.detachAndDelete()
  canvas.drawPath(stripes, r.auxStroke)
  canvas.restore()
  stripes.delete()
}

/** A value in a pill as wide as its text, its digits centred, as Figma draws padding and gaps. */
function drawValuePill(
  r: SkiaRenderer,
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  color: Color
) {
  const font = r.chromeFonts.value ?? r.chromeFonts.label
  if (!font) return
  const glyphs = font.getGlyphIDs(text)
  const advance = cachedGlyphWidth(r, font, text)
  // The ink's top and bottom, so the digits sit in the middle whatever the font's metrics.
  const bounds = font.getGlyphBounds(glyphs)
  let top = 0
  let bottom = 0
  for (let i = 0; i < bounds.length; i += 4) {
    top = Math.min(top, bounds[i + 1])
    bottom = Math.max(bottom, bounds[i + 3])
  }
  const width = advance + AUTO_LAYOUT_HOVER_VALUE_PILL_PADDING_X * 2
  const height = AUTO_LAYOUT_HOVER_VALUE_PILL_HEIGHT
  const rect = r.ck.RRectXY(
    r.ck.LTRBRect(x - width / 2, y - height / 2, x + width / 2, y + height / 2),
    AUTO_LAYOUT_HOVER_VALUE_PILL_RADIUS,
    AUTO_LAYOUT_HOVER_VALUE_PILL_RADIUS
  )
  r.auxFill.setColor(canvasColor(r, color))
  canvas.drawRRect(rect, r.auxFill)
  r.auxFill.setColorComponents(1, 1, 1, 1)
  canvas.drawText(text, x - advance / 2, y - (top + bottom) / 2, r.auxFill, font)
}

/** The pill beside a mark, upright on screen whatever the frame's rotation. */
function drawValueBeside(
  r: SkiaRenderer,
  canvas: Canvas,
  geometry: SceneGeometry,
  node: SceneNode,
  value: number,
  at: Vector,
  color: Color
) {
  const screen = geometry.toScreen(node, at, r)
  drawValuePill(
    r,
    canvas,
    String(Math.round(value)),
    screen.x + AUTO_LAYOUT_HOVER_VALUE_OFFSET,
    screen.y - AUTO_LAYOUT_HOVER_VALUE_OFFSET,
    color
  )
}

const isAcross = (side: PaddingSide) => side === 'left' || side === 'right'

/** The ticks Figma shows on every padding and gap of a hovered frame. */
function drawTicks(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph, node: SceneNode) {
  setStroke(r, AUTO_LAYOUT_HOVER_BLUE, AUTO_LAYOUT_HOVER_STROKE_WIDTH)
  for (const side of PADDING_SIDES) {
    if (paddingOf(node, side) > 0) {
      drawTick(r, canvas, paddingTick(node, side), isAcross(side) ? 'y' : 'x')
    }
  }
  setStroke(r, AUTO_LAYOUT_HOVER_MAGENTA, AUTO_LAYOUT_HOVER_STROKE_WIDTH)
  const across = node.layoutMode === 'HORIZONTAL' ? 'y' : 'x'
  for (const gap of flowGaps(node, graph)) drawTick(r, canvas, gap.tick, across)
}

export function drawAutoLayoutHover(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  hover?: RenderOverlays['autoLayoutHover'],
  preview?: RotationPreview | null
): void {
  if (!hover) return
  const node = graph.getNode(hover.nodeId)
  if (!node || (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL')) return

  if (hover.kind === 'children') strokeLayoutChildren(r, canvas, graph, node)
  const geometry = r.sceneGeometry(graph, preview)
  const gaps =
    hover.kind === 'spacing' || hover.kind === 'spacing-value' ? flowGaps(node, graph) : []
  const side = hover.kind === 'padding' || hover.kind === 'padding-value' ? hover.side : undefined
  inNodeSpace(r, canvas, geometry, node, () => {
    for (const gap of gaps) {
      drawStripedRect(
        r,
        canvas,
        gap.rect,
        AUTO_LAYOUT_HOVER_MAGENTA,
        AUTO_LAYOUT_HOVER_MAGENTA_FILL
      )
    }
    if (side) {
      drawStripedRect(
        r,
        canvas,
        paddingRect(node, side),
        AUTO_LAYOUT_HOVER_BLUE,
        AUTO_LAYOUT_HOVER_BLUE_FILL
      )
    }
    drawTicks(r, canvas, graph, node)
  })

  if (hover.kind === 'spacing-value') {
    const gap = gaps.find((candidate) => candidate.index === hover.index) ?? gaps.at(0)
    if (gap) {
      drawValueBeside(
        r,
        canvas,
        geometry,
        node,
        node.itemSpacing,
        gap.tick,
        AUTO_LAYOUT_HOVER_GAP_PILL
      )
    }
  }
  if (hover.kind === 'padding-value' && side) {
    const tick = paddingTick(node, side)
    drawValueBeside(
      r,
      canvas,
      geometry,
      node,
      paddingOf(node, side),
      tick,
      AUTO_LAYOUT_HOVER_PADDING_PILL
    )
  }
}
