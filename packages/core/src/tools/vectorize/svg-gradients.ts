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
import svgpath from 'svgpath'

import { parseColor } from '#core/color'
import type { Color, Fill, GradientStop } from '#core/scene-graph'
import type { Matrix, Rect, Vector } from '#core/types'

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

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`))
  return m ? m[1] : null
}

/** Coordinate value: bare number (userSpaceOnUse) or percent/fraction (objectBoundingBox). */
function coord(value: string | null, fallback: number): number {
  if (value == null) return fallback
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) return Number.parseFloat(trimmed) / 100
  const n = Number.parseFloat(trimmed)
  return Number.isFinite(n) ? n : fallback
}

function parseStops(body: string): RawStop[] {
  const stops: RawStop[] = []
  const stopRe = /<stop\b[^>]*\/?>/g
  let match: RegExpExecArray | null
  while ((match = stopRe.exec(body)) !== null) {
    const tag = match[0]
    const offset = coord(attr(tag, 'offset'), stops.length === 0 ? 0 : 1)
    const colorStr =
      attr(tag, 'stop-color') ?? styleProp(attr(tag, 'style'), 'stop-color') ?? '#000000'
    const opacityStr = attr(tag, 'stop-opacity') ?? styleProp(attr(tag, 'style'), 'stop-opacity')
    const color = parseColor(colorStr)
    if (opacityStr != null) {
      const a = Number.parseFloat(opacityStr)
      if (Number.isFinite(a)) color.a = a
    }
    stops.push({ offset: Math.min(1, Math.max(0, offset)), color })
  }
  return stops.sort((a, b) => a.offset - b.offset)
}

function styleProp(style: string | null, prop: string): string | null {
  if (!style) return null
  const m = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`))
  return m ? m[1].trim() : null
}

/** Parse every gradient def in the SVG into a lookup by id. */
export function parseSvgGradients(svg: string): Map<string, ParsedGradient> {
  const map = new Map<string, ParsedGradient>()
  const re = /<(linear|radial)Gradient\b([^>]*)>([\s\S]*?)<\/\1Gradient>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(svg)) !== null) {
    const kind = match[1] as 'linear' | 'radial'
    const head = `<x ${match[2]}>`
    const id = attr(head, 'id')
    if (!id) continue
    const units =
      attr(head, 'gradientUnits') === 'objectBoundingBox' ? 'objectBoundingBox' : 'userSpaceOnUse'
    map.set(id, {
      kind,
      units,
      transform: attr(head, 'gradientTransform'),
      stops: parseStops(match[3]),
      x1: coord(attr(head, 'x1'), 0),
      y1: coord(attr(head, 'y1'), 0),
      x2: coord(attr(head, 'x2'), units === 'objectBoundingBox' ? 1 : 0),
      y2: coord(attr(head, 'y2'), 0),
      cx: coord(attr(head, 'cx'), 0.5),
      cy: coord(attr(head, 'cy'), 0.5),
      r: coord(attr(head, 'r'), 0.5)
    })
  }
  return map
}

function gradientIdFromFill(fill: string | null): string | null {
  if (!fill) return null
  const m = fill.match(/^url\(\s*#([^)\s]+)\s*\)$/)
  return m ? m[1] : null
}

/**
 * Map a userSpaceOnUse point through the same element-transform + viewBox→bounds
 * pipeline applied to the path data, yielding bounds-pixel-space coordinates.
 */
function mapUserPoint(
  x: number,
  y: number,
  elementTransform: string | null,
  space: Rect,
  bounds: { width: number; height: number }
): Vector {
  const sx = bounds.width / space.width
  const sy = bounds.height / space.height
  let sp = svgpath(`M${x} ${y}`)
  if (elementTransform) sp = sp.transform(elementTransform)
  sp = sp.translate(-space.x, -space.y).scale(sx, sy)
  const out = sp.toString()
  const m = out.match(/M\s*(-?[\d.eE+-]+)[ ,]+(-?[\d.eE+-]+)/)
  if (!m) return { x, y }
  return { x: Number.parseFloat(m[1]), y: Number.parseFloat(m[2]) }
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
  space: Rect,
  bounds: { width: number; height: number },
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
        : mapUserPoint(px, py, elementTransform, space, bounds)
    return {
      x: (mapped.x - nodeBounds.x) / nodeBounds.width,
      y: (mapped.y - nodeBounds.y) / nodeBounds.height
    }
  }

  const baseColor = grad.stops[0].color
  const stops = gradientStops(grad.stops)

  if (grad.kind === 'radial') {
    const center = toLocal(grad.cx, grad.cy)
    const edge = toLocal(grad.cx + grad.r, grad.cy)
    const rx = Math.abs(edge.x - center.x) || 0.5
    const transform: Matrix = {
      m00: rx,
      m01: 0,
      m02: center.x,
      m10: 0,
      m11: rx,
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
