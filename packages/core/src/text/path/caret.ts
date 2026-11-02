import type { DerivedTextGlyph } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** How far the font reaches above and below the baseline, in ems. */
export interface PathTextLineMetrics {
  ascent: number
  descent: number
}

/** A glyph on the path in its own frame: where its baseline starts, its directions and extent. */
interface PlacedGlyph {
  origin: Vector
  /** Unit baseline direction, the way the text runs. */
  along: Vector
  /** Unit direction from the baseline to the ascender. */
  up: Vector
  advance: number
  ascent: number
  descent: number
  /** Characters the glyph draws, [start, end). */
  start: number
  end: number
}

/** A caret: a line square to the baseline from the descent to the ascent. */
export interface PathTextCaret {
  from: Vector
  to: Vector
}

function placedGlyphs(
  glyphs: readonly DerivedTextGlyph[],
  textLength: number,
  metrics: PathTextLineMetrics
): PlacedGlyph[] {
  return glyphs.map((glyph, index) => {
    const rotation = glyph.rotation ?? 0
    const along = { x: Math.cos(rotation), y: -Math.sin(rotation) }
    const next = glyphs.at(index + 1)
    // Without a saved advance a glyph reaches the next one; the last one then has no width.
    const advance =
      glyph.advance ?? (next ? (next.x - glyph.x) * along.x + (next.y - glyph.y) * along.y : 0)
    const start = glyph.firstCharacter ?? index
    return {
      origin: { x: glyph.x, y: glyph.y },
      along,
      up: { x: -Math.sin(rotation), y: -Math.cos(rotation) },
      advance: Math.max(0, advance),
      ascent: metrics.ascent * glyph.fontSize,
      descent: metrics.descent * glyph.fontSize,
      start,
      // Characters past the last glyph, cut where the text ran out of path, have no glyph.
      end: Math.min(next ? (next.firstCharacter ?? index + 1) : start + 1, textLength)
    }
  })
}

const at = (glyph: PlacedGlyph, distance: number, height: number): Vector => ({
  x: glyph.origin.x + glyph.along.x * distance + glyph.up.x * height,
  y: glyph.origin.y + glyph.along.y * distance + glyph.up.y * height
})

/** How far along a glyph its `index`th character starts, sharing a ligature's width evenly. */
function distanceOf(glyph: PlacedGlyph, index: number): number {
  const count = glyph.end - glyph.start
  if (count <= 0) return 0
  return (glyph.advance * Math.min(Math.max(index - glyph.start, 0), count)) / count
}

/**
 * The caret before character `index`: at the start of the glyph drawing it, or after the last
 * glyph when the characters from `index` on are past the end or not drawn.
 */
export function pathTextCaret(
  glyphs: readonly DerivedTextGlyph[],
  textLength: number,
  index: number,
  metrics: PathTextLineMetrics
): PathTextCaret | null {
  const placed = placedGlyphs(glyphs, textLength, metrics)
  const glyph = placed.find((candidate) => index < candidate.end) ?? placed.at(-1)
  if (!glyph) return null
  const distance = distanceOf(glyph, index)
  return { from: at(glyph, distance, -glyph.descent), to: at(glyph, distance, glyph.ascent) }
}

/**
 * The character boundary nearest a point: the glyph whose box, from the descent to the ascent,
 * the point is in or closest to, and the side of the character in it the point is on.
 */
export function pathTextIndexAt(
  glyphs: readonly DerivedTextGlyph[],
  textLength: number,
  point: Vector,
  metrics: PathTextLineMetrics
): number {
  let best: { glyph: PlacedGlyph; distance: number } | null = null
  let bestGap = Infinity
  for (const glyph of placedGlyphs(glyphs, textLength, metrics)) {
    const dx = point.x - glyph.origin.x
    const dy = point.y - glyph.origin.y
    const distance = dx * glyph.along.x + dy * glyph.along.y
    const height = dx * glyph.up.x + dy * glyph.up.y
    const gap = Math.hypot(
      Math.max(0, -distance, distance - glyph.advance),
      Math.max(0, -glyph.descent - height, height - glyph.ascent)
    )
    if (gap < bestGap) {
      bestGap = gap
      best = { glyph, distance }
    }
  }
  if (!best) return textLength
  const { glyph, distance } = best
  const count = glyph.end - glyph.start
  if (count <= 0 || glyph.advance <= 0) return glyph.start
  const step = glyph.advance / count
  return glyph.start + Math.min(Math.max(Math.round(distance / step), 0), count)
}

/** The boxes covering the characters [from, to): one per glyph they touch, rotated with it. */
export function pathTextSelectionQuads(
  glyphs: readonly DerivedTextGlyph[],
  textLength: number,
  from: number,
  to: number,
  metrics: PathTextLineMetrics
): Vector[][] {
  const quads: Vector[][] = []
  for (const glyph of placedGlyphs(glyphs, textLength, metrics)) {
    if (glyph.end <= from || glyph.start >= to) continue
    const start = distanceOf(glyph, from)
    const end = distanceOf(glyph, to)
    if (!(end > start)) continue
    quads.push([
      at(glyph, start, -glyph.descent),
      at(glyph, end, -glyph.descent),
      at(glyph, end, glyph.ascent),
      at(glyph, start, glyph.ascent)
    ])
  }
  return quads
}
