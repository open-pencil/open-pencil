import type { ColorProfile, Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { colorToProfileCSS, colorToSRGBHex } from '@open-pencil/scene-graph/color'
import { computeBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import {
  gradientPoint,
  invertGradientTransform,
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

import type { ExportEffectWarning } from './effects'
import { svg, type SVGNode } from './node'
import { round } from './paths'
import type { SVGTextLayout } from './text/lines'

export interface LayerIdJournalEntry {
  prevNames: Map<string, number | undefined>
  addedTaken: string[]
}

export interface LayerIdRegistry {
  names: Map<string, number>
  taken: Set<string>
  journal?: LayerIdJournalEntry[]
}

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
  /**
   * When layers are written with their names as ids: how many have taken each name, and every id
   * given out so far, defs included, so no two elements share one.
   */
  layerIds?: LayerIdRegistry
}

export function setLayerNameCount(ids: LayerIdRegistry, name: string, count: number): void {
  const top = ids.journal?.at(-1)
  if (top && !top.prevNames.has(name)) {
    top.prevNames.set(name, ids.names.get(name))
  }
  ids.names.set(name, count)
}

export function reserveTakenId(ids: LayerIdRegistry, id: string): void {
  if (ids.taken.has(id)) return
  const top = ids.journal?.at(-1)
  if (top) top.addedTaken.push(id)
  ids.taken.add(id)
}

export function pushLayerIdCheckpoint(ids: LayerIdRegistry): void {
  ids.journal ??= []
  ids.journal.push({ prevNames: new Map(), addedTaken: [] })
}

export function commitLayerIdCheckpoint(ids: LayerIdRegistry): void {
  const top = ids.journal?.pop()
  if (!top) return
  const parent = ids.journal?.at(-1)
  if (!parent) return
  for (const [name, prev] of top.prevNames) {
    if (!parent.prevNames.has(name)) parent.prevNames.set(name, prev)
  }
  for (const id of top.addedTaken) {
    parent.addedTaken.push(id)
  }
}

export function rollbackLayerIdCheckpoint(ids: LayerIdRegistry): void {
  const top = ids.journal?.pop()
  if (!top) return
  for (const [name, prev] of top.prevNames) {
    if (prev === undefined) ids.names.delete(name)
    else ids.names.set(name, prev)
  }
  for (const id of top.addedTaken) {
    ids.taken.delete(id)
  }
}

export function nextDefId(ctx: SVGExportContext, prefix: string): string {
  let id = `${ctx.idPrefix ?? ''}${prefix}${ctx.defIdCounter++}`
  while (ctx.layerIds?.taken.has(id)) id = `${ctx.idPrefix ?? ''}${prefix}${ctx.defIdCounter++}`
  if (ctx.layerIds) reserveTakenId(ctx.layerIds, id)
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

function createGradientDef(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
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

  // Gradient space in bounding-box units, mapped onto the layer as the canvas draws it.
  const toLayer = invertGradientTransform(t)
  const transform = isIdentityGradientTransform(toLayer)
    ? undefined
    : `matrix(${[toLayer.m00, toLayer.m10, toLayer.m01, toLayer.m11, toLayer.m02, toLayer.m12].map((v) => round(v, 6)).join(' ')})`

  if (fill.type === 'GRADIENT_LINEAR') {
    return {
      id,
      node: svg(
        'linearGradient',
        {
          id,
          x1: 0,
          y1: 0.5,
          x2: 1,
          y2: 0.5,
          gradientUnits: 'objectBoundingBox',
          gradientTransform: transform
        },
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
        {
          id,
          cx: 0.5,
          cy: 0.5,
          r: 0.5,
          gradientUnits: 'objectBoundingBox',
          gradientTransform: transform
        },
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
  ctx: SVGExportContext
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

export function resolveFill(fill: Fill, node: SceneNode, ctx: SVGExportContext): string | null {
  if (!fill.visible) return null

  if (fill.type === 'SOLID') {
    return formatSolidColor(fill.color, fill.opacity, ctx.colors)
  }

  if (fill.type.startsWith('GRADIENT')) {
    const grad = createGradientDef(fill, node, ctx)
    if (grad) {
      ctx.defs.push(grad.node)
      return `url(#${grad.id})`
    }
  }

  if (drawnImageHash(fill)) {
    const pattern = createImagePattern(fill, node, ctx)
    if (pattern) {
      ctx.defs.push(pattern.node)
      return `url(#${pattern.id})`
    }
  }

  return null
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

/** A layer's first visible stroke as SVG attributes, its color in `colors.to`. */
export function svgStrokeAttrs(
  visibleStrokes: Stroke[],
  colors: SVGColorProfiles,
  nodeCap: SceneNode['strokeCap']
): Record<string, string | number | undefined> {
  if (visibleStrokes.length === 0) return {}
  const stroke = visibleStrokes[0]
  const cap = stroke.cap ?? nodeCap
  const attrs: Record<string, string | number | undefined> = {
    // Opacity 1 keeps the color opaque. Display P3 must not also keep color alpha here, or a
    // viewer multiplies it by stroke-opacity; the canvas paints stroke.opacity alone.
    stroke: formatSolidColor(stroke.color, 1, colors),
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
