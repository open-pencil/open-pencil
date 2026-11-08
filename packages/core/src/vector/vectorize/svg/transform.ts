import { compact } from 'es-toolkit/array'
import svgpath from 'svgpath'

import type { Rect, Size, Vector } from '@open-pencil/scene-graph/primitives'

import { parseSVGDocument } from '#core/io/formats/svg/document'

export interface SVGViewportMapping {
  space: Rect
  scaleX: number
  scaleY: number
  offsetX: number
  offsetY: number
  /**
   * The outermost `<svg>` element's own transform, about the viewport center as browsers apply
   * it, in viewport coordinates and after the viewBox; null when it has none.
   */
  transform: string | null
}

/** The outermost `<svg>` attributes that place its content in the viewport, besides `viewBox`. */
export interface SVGViewportAttributes {
  /** `preserveAspectRatio`; missing means `xMidYMid meet`, `none` stretches each axis. */
  preserveAspectRatio?: string | null
  transform?: string | null
}

/** The viewport attributes of an SVG document's outermost `<svg>`. */
export function svgViewportAttributes(svg: string): SVGViewportAttributes {
  const root = parseSVGDocument(svg)?.documentElement
  return {
    preserveAspectRatio: root?.getAttribute('preserveAspectRatio') ?? null,
    transform: root?.getAttribute('transform') ?? null
  }
}

function alignmentOffset(align: string, remaining: number, axis: 'x' | 'y'): number {
  const token = axis === 'x' ? align.slice(0, 4) : align.slice(4)
  if (token.endsWith('Mid')) return remaining / 2
  if (token.endsWith('Max')) return remaining
  return 0
}

/** The root transform about the viewport center, where a browser's CSS transform origin puts it. */
function viewportTransform(transform: string | null | undefined, bounds: Size): string | null {
  const value = transform?.trim()
  if (!value || value === 'none') return null
  const cx = bounds.width / 2
  const cy = bounds.height / 2
  return `translate(${cx} ${cy}) ${value} translate(${-cx} ${-cy})`
}

/** How the viewBox `space` of an outermost `<svg>` maps into a viewport of `bounds`. */
export function resolveSVGViewportMapping(
  space: Rect,
  bounds: Size,
  attributes: SVGViewportAttributes = {}
): SVGViewportMapping {
  const scaleX = bounds.width / space.width
  const scaleY = bounds.height / space.height
  const transform = viewportTransform(attributes.transform, bounds)
  const tokens = compact((attributes.preserveAspectRatio ?? '').trim().split(/\s+/))
  if (tokens.includes('none')) return { space, scaleX, scaleY, offsetX: 0, offsetY: 0, transform }
  const align = tokens.find((token) => token.startsWith('x')) ?? 'xMidYMid'

  const uniformScale = tokens.includes('slice')
    ? Math.max(scaleX, scaleY)
    : Math.min(scaleX, scaleY)
  const remainingX = bounds.width - space.width * uniformScale
  const remainingY = bounds.height - space.height * uniformScale
  return {
    space,
    scaleX: uniformScale,
    scaleY: uniformScale,
    offsetX: alignmentOffset(align, remainingX, 'x'),
    offsetY: alignmentOffset(align, remainingY, 'y'),
    transform
  }
}

type SVGPath = ReturnType<typeof svgpath>

/** Path data through an element transform in user space, then the viewport mapping. */
export function placeSVGPath(
  d: string,
  elementTransform: string | null | undefined,
  mapping: SVGViewportMapping
): SVGPath {
  let path = svgpath(d)
  if (elementTransform && elementTransform !== 'none') path = path.transform(elementTransform)
  path = path
    .translate(-mapping.space.x, -mapping.space.y)
    .scale(mapping.scaleX, mapping.scaleY)
    .translate(mapping.offsetX, mapping.offsetY)
  return mapping.transform ? path.transform(mapping.transform) : path
}

export function mapSVGPathToViewport(d: string, mapping: SVGViewportMapping): string {
  return placeSVGPath(d, null, mapping).toString()
}

/**
 * How much a stroke drawn under `elementTransform` grows in the viewport: the shorter axis of the
 * whole placement, so scales on different axes that cancel out leave the stroke as it was.
 */
export function svgStrokeScale(
  elementTransform: string | null | undefined,
  mapping: SVGViewportMapping
): number {
  const points: Vector[] = []
  placeSVGPath('M0 0L1 0M0 0L0 1', elementTransform, mapping)
    .abs()
    .iterate((segment) => {
      if (segment[0] === 'M' || segment[0] === 'L') points.push({ x: segment[1], y: segment[2] })
    })
  if (points.length < 4) return 1
  const [origin, unitX, originY, unitY] = points
  return Math.min(
    Math.hypot(unitX.x - origin.x, unitX.y - origin.y),
    Math.hypot(unitY.x - originY.x, unitY.y - originY.y)
  )
}

/** A point through an SVG transform attribute, such as a gradient's own transform. */
export function transformSVGPoint(x: number, y: number, transform: string | null): Vector {
  if (!transform) return { x, y }
  let point: Vector = { x, y }
  svgpath(`M${x} ${y}`)
    .transform(transform)
    .abs()
    .iterate((segment) => {
      if (segment[0] === 'M') point = { x: segment[1], y: segment[2] }
    })
  return point
}

export function mapSVGPointToViewport(
  x: number,
  y: number,
  elementTransform: string | null,
  gradientTransform: string | null,
  mapping: SVGViewportMapping
): Vector {
  let path = svgpath(`M${x} ${y}`)
  if (gradientTransform) path = path.transform(gradientTransform)
  if (elementTransform) path = path.transform(elementTransform)
  path = path
    .translate(-mapping.space.x, -mapping.space.y)
    .scale(mapping.scaleX, mapping.scaleY)
    .translate(mapping.offsetX, mapping.offsetY)
  if (mapping.transform) path = path.transform(mapping.transform)
  const points: Vector[] = []
  path.abs().iterate((segment) => {
    if (points.length === 0 && segment[0] === 'M') {
      points.push({ x: segment[1], y: segment[2] })
    }
  })
  return points[0] ?? { x, y }
}

/** Apply the complete SVG transform grammar through svgpath. */
export function applySVGTransformToPath(d: string, transform: string | null): string {
  if (!transform || transform === 'none') return d
  try {
    return svgpath(d).transform(transform).toString()
  } catch (error) {
    console.warn('Ignoring unsupported SVG transform:', transform, error)
    return d
  }
}
