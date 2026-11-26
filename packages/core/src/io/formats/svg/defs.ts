import type {
  ColorProfile,
  Fill,
  GradientTransform,
  SceneGraph,
  SceneNode,
  Stroke
} from '@open-pencil/scene-graph'
import { colorToProfileCSS, colorToSRGBHex } from '@open-pencil/scene-graph/color'
import { computeBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import {
  gradientPoint,
  invertGradientTransform,
  isGradientFill,
  isIdentityGradientTransform
} from '@open-pencil/scene-graph/gradient'
import {
  drawnImageHash,
  imageDataURL,
  imageFillMatrix,
  imageSize
} from '@open-pencil/scene-graph/images'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { SVGBooleanOutlines } from './boolean/outline'
import type { ExportEffectWarning } from './effects'
import { svg, type SVGNode } from './node'
import { round } from './paths'
import type { SVGTextLayout } from './text/lines'

export interface SVGExportContext {
  defs: SVGNode[]
  defIdCounter: number
  graph: SceneGraph
  /** The profile the document's colors are in, and the one the SVG writes them in. */
  colors: SVGColorProfiles
  /** Receives each effect the export leaves out because SVG cannot draw it. */
  onWarning?: (warning: ExportEffectWarning) => void
  /** Starts every def id, so SVGs inlined on one page cannot reference each other's defs. */
  idPrefix?: string
  /** Paints drawn in `currentColor`, such as an icon's tinted paths, so CSS `color` sets them. */
  tint?: (node: SceneNode) => readonly ('fill' | 'stroke')[]
  /** Measured line breaks. Without them, only explicit newlines start a new baseline. */
  textLayout?: SVGTextLayout
  /** Combined shapes of boolean operations. Without them, saved fill geometry stands in. */
  booleanOutlines?: SVGBooleanOutlines
  /**
   * When layers are written with their names as ids: how many have taken each name, and every id
   * given out so far, defs included, so no two elements share one.
   */
  layerIds?: { names: Map<string, number>; taken: Set<string> }
}

export function nextDefId(ctx: SVGExportContext, prefix: string): string {
  let id = `${ctx.idPrefix ?? ''}${prefix}${ctx.defIdCounter++}`
  while (ctx.layerIds?.taken.has(id)) id = `${ctx.idPrefix ?? ''}${prefix}${ctx.defIdCounter++}`
  ctx.layerIds?.taken.add(id)
  return id
}

/** The `x`, `y`, `width`, and `height` of a filter or mask region around `bounds`. */
export function defRegion(bounds: VisualBounds): Record<'x' | 'y' | 'width' | 'height', number> {
  return {
    x: round(bounds.minX),
    y: round(bounds.minY),
    width: round(Math.max(0, bounds.maxX - bounds.minX)),
    height: round(Math.max(0, bounds.maxY - bounds.minY))
  }
}

/** The profile an export's colors are stored in, and the one it writes them in. */
export interface SVGColorProfiles {
  from: ColorProfile
  to: ColorProfile
}

/** Colors stored and written in sRGB, as an interface color is. */
export const SRGB_COLORS: SVGColorProfiles = { from: 'srgb', to: 'srgb' }

/**
 * A color as SVG writes it in `colors.to`: `color(display-p3 …)` for Display P3, hex for sRGB,
 * where a color sRGB cannot show is brought inside it by reducing chroma.
 */
export function formatColor(color: Color, opacity = 1, colors = SRGB_COLORS): string {
  const alphaColor = { ...color, a: color.a * opacity }
  if (colors.to === 'display-p3') {
    return colorToProfileCSS(alphaColor, colors.from, colors.to)
  }
  // Hex has no alpha. Stops and shadows already emit theirs; solid fills use `solidFillOpacity`.
  return colorToSRGBHex(alphaColor, colors.from)
}

/**
 * A solid paint's SVG color. The canvas paints `opacity` and drops color alpha: `setAlphaf`
 * replaces it, and `.pen` stores a hex alpha in both fields. Display P3 carries that painted
 * alpha in the color. sRGB hex cannot, so `solidFillOpacity` emits it beside the color.
 */
export function formatSolidColor(color: Color, opacity: number, colors: SVGColorProfiles): string {
  if (colors.to === 'display-p3') {
    return formatColor({ ...color, a: 1 }, round(opacity), colors)
  }
  return formatColor(color, 1, colors)
}

/**
 * `fill-opacity` for a solid paint. Omitted at full opacity so an opaque export stays unchanged.
 * Display P3 already carries the same alpha in the color `formatSolidColor` returns, unless
 * `separate` is set because that color was replaced and can no longer carry it.
 */
export function solidFillOpacity(
  fill: Fill,
  colors: SVGColorProfiles,
  separate = false
): number | undefined {
  if (fill.type !== 'SOLID' || (colors.to === 'display-p3' && !separate)) return undefined
  const alpha = round(fill.opacity)
  return alpha < 1 ? alpha : undefined
}

type GradientBox = 'bounding-box' | 'layer-box'

function gradientPlacement(
  t: GradientTransform,
  node: SceneNode,
  box: GradientBox
): { gradientUnits: string; gradientTransform: string | undefined } {
  const toBox = invertGradientTransform(t)
  if (box === 'bounding-box') {
    return {
      gradientUnits: 'objectBoundingBox',
      gradientTransform: isIdentityGradientTransform(toBox)
        ? undefined
        : svgMatrix(Matrix.fromAffine(toBox))
    }
  }
  // SVG paints no objectBoundingBox gradient on a box without width or height, as a straight line's.
  const toLayer = Matrix.multiply(
    Matrix.scaled(node.width || 1, node.height || 1),
    Matrix.fromAffine(toBox)
  )
  return { gradientUnits: 'userSpaceOnUse', gradientTransform: svgMatrix(toLayer) }
}

function createGradientDef(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext,
  box: GradientBox
): { id: string; node: SVGNode } | null {
  const stops = fill.gradientStops
  const t = fill.gradientTransform
  if (!stops || !t) return null

  const stopNodes = stops.map((s) =>
    svg('stop', {
      offset: `${round(s.position * 100)}%`,
      // Alpha goes in stop-opacity alone; a P3 stop-color would carry it too, and SVG multiplies.
      'stop-color': formatColor({ ...s.color, a: 1 }, 1, ctx.colors),
      'stop-opacity': s.color.a < 1 ? round(s.color.a) : undefined
    })
  )

  const id = nextDefId(ctx, 'grad')

  if (fill.type === 'GRADIENT_LINEAR') {
    return {
      id,
      node: svg(
        'linearGradient',
        { id, x1: 0, y1: 0.5, x2: 1, y2: 0.5, ...gradientPlacement(t, node, box) },
        ...stopNodes
      )
    }
  }

  // SVG has no diamond gradient, so a diamond exports as the radial one it is closest to.
  if (fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_DIAMOND') {
    return {
      id,
      node: svg(
        'radialGradient',
        { id, cx: 0.5, cy: 0.5, r: 0.5, ...gradientPlacement(t, node, box) },
        ...stopNodes
      )
    }
  }

  // Nor an angular one: it exports as a radial gradient around its centre.
  if (fill.type === 'GRADIENT_ANGULAR') {
    const center = gradientPoint(t, { x: 0.5, y: 0.5 })
    const cx = round(center.x * node.width)
    const cy = round(center.y * node.height)
    const r = Math.max(node.width, node.height)
    return {
      id,
      node: svg('radialGradient', { id, cx, cy, r, gradientUnits: 'userSpaceOnUse' }, ...stopNodes)
    }
  }

  return null
}

/** An SVG `matrix()` for a row-major 3 × 3 transform. */
function svgMatrix(m: Mat3): string {
  return `matrix(${[m[0], m[3], m[1], m[4], m[2], m[5]].map((value) => round(value, 6)).join(' ')})`
}

/**
 * An image fill as a pattern in the layer's own units, the image placed as the canvas places it
 * (`imageFillMatrix`): a crop by its transform, Fill and Fit turned and fitted, a tile repeated
 * at its scale. An image whose size cannot be read covers the layer, or fits it for Fit.
 */
function createImagePattern(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext,
  strokeReach = 0
): { id: string; node: SVGNode } | null {
  const imageHash = drawnImageHash(fill)
  if (!imageHash) {
    return null
  }
  const data = ctx.graph.images.get(imageHash)
  if (!data) return null

  const id = nextDefId(ctx, 'img')
  const href = imageDataURL(data)
  const size = imageSize(data)
  if (!size) {
    return {
      id,
      node: svg(
        'pattern',
        { id, patternUnits: 'objectBoundingBox', width: 1, height: 1 },
        svg('image', {
          href,
          width: node.width,
          height: node.height,
          preserveAspectRatio: fill.imageScaleMode === 'FIT' ? 'xMidYMid meet' : 'xMidYMid slice'
        })
      )
    }
  }
  const matrix = imageFillMatrix(fill, node, size.width, size.height)
  if (strokeReach > 0 && fill.imageScaleMode !== 'TILE') {
    const image = { href, width: size.width, height: size.height }
    return { id, node: strokeImagePattern(id, image, fill, node, matrix, strokeReach, ctx) }
  }
  const tile =
    fill.imageScaleMode === 'TILE'
      ? computeBounds(
          [
            Matrix.mapPoint(matrix, { x: 0, y: 0 }),
            Matrix.mapPoint(matrix, { x: size.width, y: size.height }),
            Matrix.mapPoint(matrix, { x: size.width, y: 0 }),
            Matrix.mapPoint(matrix, { x: 0, y: size.height })
          ].map((point) => ({ ...point, width: 0, height: 0 }))
        )
      : { width: node.width, height: node.height }
  return {
    id,
    node: svg(
      'pattern',
      // The tile unrounded, so the image repeats at the period the canvas repeats it at.
      {
        id,
        patternUnits: 'userSpaceOnUse',
        width: round(tile.width, 6),
        height: round(tile.height, 6)
      },
      svg('image', {
        href,
        width: size.width,
        height: size.height,
        preserveAspectRatio: 'none',
        transform: svgMatrix(matrix)
      })
    )
  }
}

/** How far past its layer's box a stroke can paint, its mitred corners included. */
export function strokeReach(stroke: Stroke, node: SceneNode): number {
  return stroke.weight * Math.max(2, node.strokeMiterLimit)
}

/** Half a pixel, so a stretched edge samples that pixel alone. */
const EDGE_SLIVER = 0.5

const CLAMP_SIDES = [-1, 0, 1] as const

interface PatternImage {
  href: string
  width: number
  height: number
}

/**
 * An image stroke's pattern, one copy of the image over all the stroke reaches past the layer's
 * box: beyond the image, Fit draws nothing and Fill and Crop stretch its edge pixels, as the canvas
 * samples them.
 */
function strokeImagePattern(
  id: string,
  image: PatternImage,
  fill: Fill,
  node: SceneNode,
  matrix: Mat3,
  reach: number,
  ctx: SVGExportContext
): SVGNode {
  const region = {
    id,
    patternUnits: 'userSpaceOnUse',
    x: round(-reach, 6),
    y: round(-reach, 6),
    width: round(node.width + 2 * reach, 6),
    height: round(node.height + 2 * reach, 6)
  }
  const placed = svgMatrix(Matrix.multiply(Matrix.translated(reach, reach), matrix))
  const unstretched = { ...image, preserveAspectRatio: 'none' }
  if (fill.imageScaleMode === 'FIT') {
    return svg('pattern', region, svg('image', { ...unstretched, transform: placed }))
  }
  const sourceId = nextDefId(ctx, 'imgsrc')
  const edges = clampedEdges(image, clampExtent(image, node, matrix, reach), sourceId)
  return svg(
    'pattern',
    region,
    svg('g', { transform: placed }, svg('image', { id: sourceId, ...unstretched }), ...edges)
  )
}

/** Each side and corner around an image, its nearest half pixel stretched `extent` pixels out. */
function clampedEdges(image: PatternImage, extent: number, sourceId: string): SVGNode[] {
  const span = (side: number, length: number) => {
    if (side < 0) {
      return { at: -extent, length: extent, from: 0, sliver: EDGE_SLIVER }
    }
    if (side > 0) {
      return { at: length, length: extent, from: length - EDGE_SLIVER, sliver: EDGE_SLIVER }
    }
    return { at: 0, length, from: 0, sliver: length }
  }
  return CLAMP_SIDES.flatMap((sideX) =>
    CLAMP_SIDES.filter((sideY) => sideX !== 0 || sideY !== 0).map((sideY) => {
      const x = span(sideX, image.width)
      const y = span(sideY, image.height)
      const viewBox = [x.from, y.from, x.sliver, y.sliver].map((value) => round(value, 6))
      return svg(
        'svg',
        {
          x: round(x.at, 6),
          y: round(y.at, 6),
          width: round(x.length, 6),
          height: round(y.length, 6),
          viewBox: viewBox.join(' '),
          preserveAspectRatio: 'none'
        },
        svg('use', { href: `#${sourceId}` })
      )
    })
  )
}

/** How many of the image's pixels the stroke's reach goes past its farthest edge. */
function clampExtent(image: PatternImage, node: SceneNode, matrix: Mat3, reach: number): number {
  const toImage = Matrix.invert(matrix)
  if (!toImage) {
    return 0
  }
  const corners = [
    { x: -reach, y: -reach },
    { x: node.width + reach, y: -reach },
    { x: node.width + reach, y: node.height + reach },
    { x: -reach, y: node.height + reach }
  ].map((corner) => ({ ...Matrix.mapPoint(toImage, corner), width: 0, height: 0 }))
  const bounds = computeBounds(corners)
  const beyond = Math.max(
    0,
    -bounds.x,
    -bounds.y,
    bounds.x + bounds.width - image.width,
    bounds.y + bounds.height - image.height
  )
  return Math.ceil(beyond)
}

function paintServer(def: { id: string; node: SVGNode } | null, ctx: SVGExportContext) {
  if (!def) {
    return null
  }
  ctx.defs.push(def.node)
  return `url(#${def.id})`
}

export function resolveFill(fill: Fill, node: SceneNode, ctx: SVGExportContext): string | null {
  if (!fill.visible) return null

  if (fill.type === 'SOLID') {
    return formatSolidColor(fill.color, fill.opacity, ctx.colors)
  }

  if (isGradientFill(fill.type)) {
    const grad = paintServer(createGradientDef(fill, node, ctx, 'bounding-box'), ctx)
    if (grad) {
      return grad
    }
  }

  if (drawnImageHash(fill)) {
    return paintServer(createImagePattern(fill, node, ctx), ctx)
  }

  return null
}

function resolveStroke(stroke: Stroke, node: SceneNode, ctx: SVGExportContext): string | null {
  if (isGradientFill(stroke.type) && stroke.gradientStops && stroke.gradientTransform) {
    return paintServer(createGradientDef(stroke, node, ctx, 'layer-box'), ctx)
  }
  if (drawnImageHash(stroke)) {
    return paintServer(createImagePattern(stroke, node, ctx, strokeReach(stroke, node)), ctx)
  }
  // Opaque: in Display P3 a viewer would multiply a color's alpha by `stroke-opacity`.
  return formatSolidColor(stroke.color, 1, ctx.colors)
}

function skippedStroke(stroke: Stroke, graph: SceneGraph): boolean {
  const imageHash = stroke.visible ? drawnImageHash(stroke) : undefined
  return imageHash !== undefined && !graph.images.has(imageHash)
}

/** The layer without the visible strokes the canvas skips: image strokes whose image is missing. */
export function withDrawnStrokes(node: SceneNode, graph: SceneGraph): SceneNode {
  if (!node.strokes.some((stroke) => skippedStroke(stroke, graph))) {
    return node
  }
  return { ...node, strokes: node.strokes.filter((stroke) => !skippedStroke(stroke, graph)) }
}

/** The paints SVG can draw, each with its fill attribute: a stroke goes on the last of them. */
export function drawnFills(
  fills: readonly Fill[],
  node: SceneNode,
  ctx: SVGExportContext
): Array<{ fill: Fill; paint: string }> {
  return fills.flatMap((fill) => {
    const paint = resolveFill(fill, node, ctx)
    return paint ? [{ fill, paint }] : []
  })
}

export const SVG_STROKE_CAP: Record<string, string> = {
  NONE: 'butt',
  ROUND: 'round',
  SQUARE: 'square'
}

export const SVG_STROKE_JOIN: Record<string, string> = {
  MITER: 'miter',
  ROUND: 'round',
  BEVEL: 'bevel'
}

/** A layer's first visible stroke as SVG attributes, its paint in `colors.to`. */
export function svgStrokeAttrs(
  visibleStrokes: Stroke[],
  node: SceneNode,
  ctx: SVGExportContext
): Record<string, string | number | undefined> {
  if (visibleStrokes.length === 0) return {}
  const stroke = visibleStrokes[0]
  const paint = resolveStroke(stroke, node, ctx)
  if (!paint) {
    return {}
  }
  const cap = stroke.cap ?? node.strokeCap
  const attrs: Record<string, string | number | undefined> = {
    stroke: paint,
    'stroke-width': round(stroke.weight)
  }
  if (stroke.opacity < 1) attrs['stroke-opacity'] = round(stroke.opacity)
  if (cap !== 'NONE') attrs['stroke-linecap'] = SVG_STROKE_CAP[cap] ?? 'butt'
  if (stroke.join && stroke.join !== 'MITER') {
    attrs['stroke-linejoin'] = SVG_STROKE_JOIN[stroke.join] ?? 'miter'
  }
  if (stroke.dashPattern && stroke.dashPattern.length > 0) {
    attrs['stroke-dasharray'] = stroke.dashPattern.map((n) => round(n)).join(' ')
  }
  return attrs
}
