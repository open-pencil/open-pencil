import { omit } from 'es-toolkit'

import type { Fill, SceneNode, Stroke, VectorNetwork } from '../types'
import { readIcon, readIconTint } from './model'

/** What reading an icon's paths needs of a graph. */
interface IconGraph {
  getChildren(id: string): SceneNode[]
}

/** Digits kept of each proportion, so float noise does not read as an edit. */
const PRECISION = 1000

const round = (value: number) => Math.round(value * PRECISION) / PRECISION

/**
 * A path's points in proportion to their own bounds on each axis. Resizing scales vertices by
 * exact factors, so these proportions survive any resize, while the path boxes around them are
 * rounded to pixels and are left out.
 */
function shape(network: VectorNetwork | null | undefined) {
  if (!network) return null
  // A saved document keeps coordinates as 32-bit floats, so they are read at that precision
  // either way; rounding alone would still split a value that lands on a rounding boundary.
  const f = Math.fround
  const xs = network.vertices.map((vertex) => f(vertex.x))
  const ys = network.vertices.map((vertex) => f(vertex.y))
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const sx = 1 / (Math.max(...xs) - minX || 1)
  const sy = 1 / (Math.max(...ys) - minY || 1)
  return {
    vertices: network.vertices.map((vertex) => [
      round((f(vertex.x) - minX) * sx),
      round((f(vertex.y) - minY) * sy),
      vertex.strokeCap ?? null,
      vertex.strokeJoin ?? null
    ]),
    segments: network.segments.map((segment) => [
      segment.start,
      segment.end,
      round(f(segment.tangentStart.x) * sx),
      round(f(segment.tangentStart.y) * sy),
      round(f(segment.tangentEnd.x) * sx),
      round(f(segment.tangentEnd.y) * sy)
    ]),
    regions: network.regions
  }
}

/**
 * Paint fields that read the same as when they are absent, which saving and loading a document
 * fills in: a normal blend and no dashes.
 */
const PAINT_DEFAULTS: Readonly<Record<string, unknown>> = { blendMode: 'NORMAL' }

/**
 * A value described the same however it was stored: keys sorted, defaults and empty lists left
 * out, and numbers rounded, since a saved document keeps them at lower precision.
 */
function canonical(value: unknown): unknown {
  // Stored as 32-bit floats too, so read at that precision before rounding, as coordinates are.
  if (typeof value === 'number') return round(Math.fround(value))
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value !== 'object' || value === null) return value
  const entries = Object.entries(value)
    .filter(
      ([key, item]) =>
        item !== undefined &&
        PAINT_DEFAULTS[key] !== item &&
        !(Array.isArray(item) && item.length === 0)
    )
    .sort(([a], [b]) => a.localeCompare(b))
  return Object.fromEntries(entries.map(([key, item]) => [key, canonical(item)]))
}

/**
 * A paint as it looks, leaving out the color when the icon's color sets it, and a stroke's
 * weight, which resizing scales.
 */
function paint(fill: Fill | Stroke, tinted: boolean) {
  const { color, ...rest } = 'weight' in fill ? omit(fill, ['weight']) : fill
  return canonical(tinted ? rest : { ...rest, color })
}

/** FNV-1a, enough to tell one glyph from another without keeping the whole description. */
function hash(text: string): string {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return (value >>> 0).toString(16).padStart(8, '0')
}

/**
 * A fingerprint of what an icon frame draws: which paths it holds and their shapes, stroke ends,
 * and paints. Resizing the icon, however unevenly, or changing its color leaves it unchanged;
 * editing points, rotating or fading a path, adding or removing one, or changing a color of the
 * icon's own changes it. Moving a whole path or changing its stroke weight does not count, since
 * resizing changes those by rounded amounts too.
 */
export function iconGlyph(graph: IconGraph, frame: SceneNode): string {
  const description = graph.getChildren(frame.id).map((path) => {
    const tint = readIconTint(path)
    return {
      type: path.type,
      shape: shape(path.vectorNetwork),
      fills: path.fills.map((fill) => paint(fill, tint.includes('fill'))),
      strokes: path.strokes.map((stroke) => paint(stroke, tint.includes('stroke'))),
      ends: [path.strokeCap, path.strokeJoin],
      // Resizing leaves these alone, so they count, unlike a path's place and stroke weight.
      rotation: round(path.rotation),
      opacity: round(path.opacity),
      visible: path.visible
    }
  })
  return hash(JSON.stringify(description))
}

/**
 * Whether an icon frame no longer draws the glyph it was placed with: its paths were edited,
 * added, or removed. An icon placed before glyphs were recorded counts as unedited.
 */
export function isIconModified(graph: IconGraph, frame: SceneNode): boolean {
  const glyph = readIcon(frame)?.glyph
  return glyph !== undefined && iconGlyph(graph, frame) !== glyph
}
