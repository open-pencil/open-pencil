/**
 * Parse SVG <linearGradient>/<radialGradient> defs and resolve `fill="url(#id)"`
 * references into scene-graph gradient fills.
 *
 * Raster vectorizers (Recraft, fal) emit shaded regions as gradients rather than
 * flat colors. Without this, those paths fall back to the default solid color
 * (black). Gradient geometry is given in userSpaceOnUse viewBox coordinates; we
 * map the endpoints through the same transform pipeline as the path data, then
 * normalize into each node's bounding box (objectBoundingBox) space, matching the
 * gradientTransform convention used by the SVG exporter (see io/formats/svg/defs).
 */
import type { Fill, GradientStop } from '@open-pencil/scene-graph'
import type { Color, Matrix, Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import { parseSVGDocument } from '#core/io/formats/svg/document'

import { mapSVGPointToViewport, type SVGViewportMapping } from './transform'

interface RawStop {
  offset: number
  color: Color
}

interface ParsedGradient {
  kind: 'linear' | 'radial'
  units: 'userSpaceOnUse' | 'objectBoundingBox'
  transform: string | null
  stops: RawStop[]
  // linear
  x1: number
  y1: number
  x2: number
  y2: number
  // radial
  cx: number
  cy: number
  r: number
}

/** Minimal structural view of the parsed XML nodes we read (DOM-compatible). */
interface SVGQueryable {
  getElementsByTagName(name: string): ArrayLike<SVGElementLike>
}
interface SVGElementLike extends SVGQueryable {
  getAttribute(name: string): string | null
}

/** Coordinate value: bare number (userSpaceOnUse) or percent/fraction (objectBoundingBox). */
function coord(value: string | null, fallback: number): number {
  if (value == null) return fallback
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) return Number.parseFloat(trimmed) / 100
  const n = Number.parseFloat(trimmed)
  return Number.isFinite(n) ? n : fallback
}

function readStops(gradient: SVGElementLike): RawStop[] {
  const stops: RawStop[] = []
  const stopEls = Array.from(gradient.getElementsByTagName('stop'))
  for (const [i, stop] of stopEls.entries()) {
    const offset = coord(stop.getAttribute('offset'), i === 0 ? 0 : 1)
    const color = parseColor(stop.getAttribute('stop-color') ?? '#000000')
    const opacity = stop.getAttribute('stop-opacity')
    if (opacity != null) {
      const a = Number.parseFloat(opacity)
      if (Number.isFinite(a)) color.a = a
    }
    stops.push({ offset: Math.min(1, Math.max(0, offset)), color })
  }
  return stops.sort((a, b) => a.offset - b.offset)
}

/**
 * Parse every gradient def in the SVG into a lookup by id, via an XML/DOM parse
 * (no hand-rolled markup parsing). Returns an empty map on parse failure so a
 * malformed SVG simply falls back to solid fills.
 */
export function parseSVGGradients(svg: string): Map<string, ParsedGradient> {
  const map = new Map<string, ParsedGradient>()
  const doc: SVGQueryable | null = parseSVGDocument(svg)
  if (!doc) return map

  for (const kind of ['linear', 'radial'] as const) {
    const els = Array.from(doc.getElementsByTagName(`${kind}Gradient`))
    for (const el of els) {
      const id = el.getAttribute('id')
      if (!id) continue
      // SVG default gradientUnits is objectBoundingBox; vectorizers (Recraft/fal)
      // set userSpaceOnUse explicitly.
      const units =
        el.getAttribute('gradientUnits') === 'userSpaceOnUse'
          ? 'userSpaceOnUse'
          : 'objectBoundingBox'
      map.set(id, {
        kind,
        units,
        transform: el.getAttribute('gradientTransform'),
        stops: readStops(el),
        x1: coord(el.getAttribute('x1'), 0),
        y1: coord(el.getAttribute('y1'), 0),
        x2: coord(el.getAttribute('x2'), units === 'objectBoundingBox' ? 1 : 0),
        y2: coord(el.getAttribute('y2'), 0),
        cx: coord(el.getAttribute('cx'), 0.5),
        cy: coord(el.getAttribute('cy'), 0.5),
        r: coord(el.getAttribute('r'), 0.5)
      })
    }
  }
  return map
}

function gradientIdFromFill(fill: string | null): string | null {
  const value = fill?.trim()
  if (!value?.startsWith('url(') || !value.endsWith(')')) return null
  const reference = value.slice(4, -1).trim()
  if (!reference.startsWith('#')) return null
  const id = reference.slice(1).trim()
  return id && !id.includes(' ') ? id : null
}

function gradientStops(stops: RawStop[]): GradientStop[] {
  return stops.map((s) => ({ color: s.color, position: s.offset }))
}

/**
 * Build a scene-graph gradient Fill for `fill="url(#id)"`, with its transform
 * expressed in the path's normalized bounding-box space (`nodeBounds` in the same
 * bounds-pixel space as the parsed network).
 */
export function resolveGradientFill(
  fillRef: string | null,
  gradients: Map<string, ParsedGradient>,
  elementTransform: string | null,
  viewport: SVGViewportMapping,
  nodeBounds: Rect
): Fill | null {
  const id = gradientIdFromFill(fillRef)
  if (!id) return null
  const grad = gradients.get(id)
  if (!grad || grad.stops.length === 0) return null
  if (nodeBounds.width <= 0 || nodeBounds.height <= 0) return null

  const toLocal = (px: number, py: number): Vector => {
    const mapped =
      grad.units === 'objectBoundingBox'
        ? { x: nodeBounds.x + px * nodeBounds.width, y: nodeBounds.y + py * nodeBounds.height }
        : mapSVGPointToViewport(px, py, elementTransform, grad.transform, viewport)
    return {
      x: (mapped.x - nodeBounds.x) / nodeBounds.width,
      y: (mapped.y - nodeBounds.y) / nodeBounds.height
    }
  }

  const baseColor = grad.stops[0].color
  const stops = gradientStops(grad.stops)

  if (grad.kind === 'radial') {
    const center = toLocal(grad.cx, grad.cy)
    const edgeX = toLocal(grad.cx + grad.r, grad.cy)
    const edgeY = toLocal(grad.cx, grad.cy + grad.r)
    const transform: Matrix = {
      m00: edgeX.x - center.x,
      m01: edgeY.x - center.x,
      m02: center.x,
      m10: edgeX.y - center.y,
      m11: edgeY.y - center.y,
      m12: center.y
    }
    return {
      type: 'GRADIENT_RADIAL',
      color: baseColor,
      opacity: 1,
      visible: true,
      gradientStops: stops,
      gradientTransform: transform
    }
  }

  const start = toLocal(grad.x1, grad.y1)
  const end = toLocal(grad.x2, grad.y2)
  const ax = end.x - start.x
  const ay = end.y - start.y
  const transform: Matrix = {
    m00: ax,
    m01: -ay,
    m02: start.x,
    m10: ay,
    m11: ax,
    m12: start.y
  }
  return {
    type: 'GRADIENT_LINEAR',
    color: baseColor,
    opacity: 1,
    visible: true,
    gradientStops: stops,
    gradientTransform: transform
  }
}
