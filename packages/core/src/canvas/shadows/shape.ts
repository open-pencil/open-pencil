import type { Canvas, Path } from 'canvaskit-wasm'

import type { BlendMode, Effect, SceneNode, Stroke } from '@open-pencil/scene-graph'

import { setPaintBlendMode } from '#core/canvas/blend'
import { blurSigma } from '#core/canvas/effects'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { drawOutline, makeNodeShapePath, nodeHasRadius, withNodeOutline } from '#core/canvas/shapes'
import { sideStrokeRRects, strokeAlignShare } from '#core/canvas/strokes/sides'

import { fillsCastShadow, paintCastsShadow } from './silhouette'

/** Whether every region of a vector casts a shadow, from its own paints or the layer's. */
function regionsCastShadow(node: SceneNode): boolean {
  const regions = node.vectorNetwork?.regions ?? []
  return regions.every((region) => (region.fills ?? node.fills).some(paintCastsShadow))
}

/**
 * Whether the node's fill outline is its whole shadow: it casts from a fill, every region of a
 * vector casts too, and no stroke reaches past it.
 */
export function castsFromOwnShape(node: SceneNode): boolean {
  return (
    node.type !== 'TEXT' &&
    node.type !== 'BOOLEAN_OPERATION' &&
    !isPartialArc(node) &&
    regionsCastShadow(node) &&
    fillsCastShadow(node) &&
    node.strokes.every((stroke) => !paintCastsShadow(stroke) || stroke.align === 'INSIDE')
  )
}

/** Whether a layer's drop shadow comes from its own outline alone, which the paths below draw. */
export function castsOwnShapeDropShadow(node: SceneNode, spread: number): boolean {
  return regularStrokeOutline(node, spread) !== null || castsFromOwnShape(node)
}

const OUTLINE_SHAPE_TYPES: ReadonlySet<SceneNode['type']> = new Set<SceneNode['type']>([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'SECTION'
])

/**
 * A pie, donut, or open arc. The shadow paths below draw ellipses as ovals, so these take the
 * silhouette, which draws the arc itself.
 */
function isPartialArc(node: SceneNode): boolean {
  const arc = node.type === 'ELLIPSE' ? node.arcData : null
  if (!arc) return false
  return arc.innerRadius > 0 || Math.abs(arc.endingAngle - arc.startingAngle) < 2 * Math.PI - 1e-6
}

/** Distances from each side of a rectangle: top, right, bottom, left. */
type Sides = readonly [number, number, number, number]

const evenSides = (distance: number): Sides => [distance, distance, distance, distance]

/** How far a shape's stroke reaches past each side of it (`outset`) and into it (`inset`). */
export interface StrokeOutline {
  outset: Sides
  inset: Sides
  /** Every side reaches as far, so the outline is the shape itself grown. */
  even: boolean
  align: Stroke['align']
}

function sideOutline([top, right, bottom, left]: Sides, align: Stroke['align']): StrokeOutline {
  const share = strokeAlignShare(align)
  return {
    outset: [top * share, right * share, bottom * share, left * share],
    inset: [top * (1 - share), right * (1 - share), bottom * (1 - share), left * (1 - share)],
    even: false,
    align
  }
}

/**
 * For a rectangle, ellipse, or frame with at most one plain stroke, the outline that stroke
 * gives it; null when the outline is not the shape grown, as with dashes or a sharp corner the
 * stroke does not miter. Sides of their own weights give the ring of `sideStrokeRRects`, but
 * measured on Figma 126, a shadow with a spread grows every side by the layer's single weight.
 */
export function regularStrokeOutline(node: SceneNode, spread: number): StrokeOutline | null {
  if (!OUTLINE_SHAPE_TYPES.has(node.type) || isPartialArc(node)) return null
  const strokes = node.strokes.filter(paintCastsShadow)
  if (strokes.length === 0) return evenOutline(0, 'INSIDE')
  const [stroke] = strokes
  if (strokes.length > 1 || stroke.dashPattern?.length) return null
  const sharp = node.type !== 'ELLIPSE' && !nodeHasRadius(node)
  if (node.independentStrokeWeights && node.type !== 'ELLIPSE') {
    const sides: Sides = [
      node.borderTopWeight,
      node.borderRightWeight,
      node.borderBottomWeight,
      node.borderLeftWeight
    ]
    if (sides.every((weight) => weight === sides[0])) return evenOutline(sides[0], stroke.align)
    if (spread !== 0) return evenOutline(node.strokeWeight, stroke.align)
    return sideOutline(sides, stroke.align)
  }
  if (sharp && (stroke.join ?? node.strokeJoin) !== 'MITER') return null
  return evenOutline(stroke.weight, stroke.align)
}

function evenOutline(weight: number, align: Stroke['align']): StrokeOutline {
  const outset = weight * strokeAlignShare(align)
  return { outset: evenSides(outset), inset: evenSides(weight - outset), even: true, align }
}

/** The outline the node's stroke gives it, grown further by `spread`. */
function strokeOutlinePath(
  r: SkiaRenderer,
  node: SceneNode,
  outline: StrokeOutline,
  spread: number
): Path {
  if (outline.even) return makeNodeShapePath(r, node, outline.outset[0] + spread)
  const builder = new r.ck.PathBuilder()
  builder.addRRect(sideStrokeRRects(node, outline.align, spread).outer)
  return builder.detachAndDelete()
}

/**
 * Draws what `draw` paints with `r.auxFill` as a shadow, offset and blurred as a mask, which lets
 * Skia blur rectangles and rounded rectangles analytically.
 */
function drawMaskShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  effect: Effect,
  blendMode: BlendMode | undefined,
  draw: () => void
): void {
  r.auxFill.setColor(r.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a))
  r.auxFill.setMaskFilter(r.getCachedMaskBlur(blurSigma(effect.radius)))
  r.auxFill.setImageFilter(null)
  setPaintBlendMode(r, r.auxFill, blendMode)
  canvas.save()
  try {
    canvas.translate(effect.offset.x, effect.offset.y)
    draw()
  } finally {
    canvas.restore()
    r.auxFill.setMaskFilter(null)
    r.auxFill.setBlendMode(r.ck.BlendMode.SrcOver)
  }
}

/** Draws a shadow cast by the node's fill outline grown by `spread`. */
export function drawShapeDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: Effect,
  spread: number,
  blendMode: BlendMode | undefined
): void {
  drawMaskShadow(r, canvas, effect, blendMode, () =>
    withNodeOutline(r, node, (outline) => drawOutline(canvas, outline, r.auxFill), spread)
  )
}

/** Whether the stroke reaches past the shape on any side, so it grows the shadow. */
export function strokeGrowsOutline(outline: StrokeOutline): boolean {
  return outline.outset.some((distance) => distance > 0)
}

/** Draws a shadow cast by the shape grown by its stroke and the spread. */
export function drawOutlineDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: Effect,
  outline: StrokeOutline,
  spread: number,
  blendMode: BlendMode | undefined
): void {
  drawMaskShadow(r, canvas, effect, blendMode, () => {
    if (outline.even) {
      const grow = outline.outset[0] + spread
      withNodeOutline(r, node, (shape) => drawOutline(canvas, shape, r.auxFill), grow)
    } else canvas.drawRRect(sideStrokeRRects(node, outline.align, spread).outer, r.auxFill)
  })
}

/** Draws the shadow of a stroke without a fill: the ring between its outline and its inner edge. */
export function drawRingDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: Effect,
  outline: StrokeOutline,
  spread: number,
  blendMode: BlendMode | undefined
): void {
  const builder = new r.ck.PathBuilder()
  if (outline.even) {
    const outer = strokeOutlinePath(r, node, outline, spread)
    builder.addPath(outer)
    outer.delete()
    const inset = outline.inset[0] + spread
    if (inset * 2 < Math.min(node.width, node.height)) {
      const inner = makeNodeShapePath(r, node, -inset)
      builder.addPath(inner)
      inner.delete()
    }
  } else {
    const { outer, inner } = sideStrokeRRects(node, outline.align, spread)
    builder.addRRect(outer)
    if (inner) builder.addRRect(inner)
  }
  const ring = builder.detachAndDelete()
  ring.setFillType(r.ck.FillType.EvenOdd)
  try {
    drawMaskShadow(r, canvas, effect, blendMode, () => canvas.drawPath(ring, r.auxFill))
  } finally {
    ring.delete()
  }
}

/** Clips out the area a shape hides its shadow under: the shape grown by its stroke. */
export function clipOutShapeKnockout(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  outline: StrokeOutline | null
): void {
  const path = outline ? strokeOutlinePath(r, node, outline, 0) : makeNodeShapePath(r, node)
  canvas.clipPath(path, r.ck.ClipOp.Difference, true)
  path.delete()
}

/**
 * Draws an inner shadow: everything outside the shape, moved by the shadow's offset and grown
 * into the shape by its spread, blurred and clipped to the shape. `isolated` says the shape's fills
 * sit in a layer of their own, as `isolatesInnerShadows` has them.
 */
export function drawShapeInnerShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: Effect,
  spread: number,
  isolated = false
): void {
  const sp = spread
  r.auxFill.setColorComponents(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
  r.auxFill.setImageFilter(r.getCachedDecalBlur(blurSigma(effect.radius)))

  canvas.save()
  try {
    const expand = effect.radius * 2
    const { x: offsetX, y: offsetY } = effect.offset
    const spreadPadding = sp < 0 ? -sp : 0
    const area = new r.ck.PathBuilder()
    area.addRect(
      r.ck.LTRBRect(
        Math.min(-expand, -expand + offsetX - spreadPadding),
        Math.min(-expand, -expand + offsetY - spreadPadding),
        Math.max(node.width + expand, node.width + expand + offsetX + spreadPadding),
        Math.max(node.height + expand, node.height + expand + offsetY + spreadPadding)
      )
    )
    const shrunk = makeNodeShapePath(r, node, -sp)
    const moved = new r.ck.PathBuilder()
    moved.addPath(shrunk, r.ck.Matrix.translated(offsetX, offsetY))
    shrunk.delete()
    const areaPath = area.detachAndDelete()
    const shapePath = moved.detachAndDelete()
    const shadowPath = r.ck.Path.MakeFromOp(areaPath, shapePath, r.ck.PathOp.Difference)
    areaPath.delete()
    shapePath.delete()
    if (!shadowPath) return
    if (isolated) {
      // Alone over the fills, the shadow takes the fill out from under it before it is clipped,
      // so the outline's antialiased edge applies once and no fill shows through it.
      r.auxFill.setBlendMode(r.ck.BlendMode.DstOut)
      canvas.drawPath(shadowPath, r.auxFill)
      r.auxFill.setBlendMode(r.ck.BlendMode.Plus)
    } else {
      setPaintBlendMode(r, r.auxFill, effect.blendMode)
    }
    r.clipNodeShape(canvas, node)
    canvas.drawPath(shadowPath, r.auxFill)
    shadowPath.delete()
  } finally {
    canvas.restore()
    r.auxFill.setImageFilter(null)
    r.auxFill.setBlendMode(r.ck.BlendMode.SrcOver)
  }
}
