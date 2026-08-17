import type { DerivedTextGlyph, TextPathData } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { nearestArcPoint, pointAtArc, sampleTextPath, type SampledPath } from './sampling'

/**
 * A closed ribbon polygon (node-local, flat `[x0,y0,x1,y1,...]`) that hugs the
 * lettering along the path — the Figma-style "selection band" for text on a
 * path. It runs along the arc the glyphs occupy, offset out to ~cap height and
 * in to ~descender, so a filled/stroked polygon traces the text instead of the
 * flat axis-aligned selection rects (which float over the artwork). Returns null
 * with no glyphs or an unsampleable path.
 *
 * The outward side is chosen per-sample as the normal pointing away from the box
 * centre (correct for the common circular/arc case); the band straddles the
 * baseline so it covers the glyphs without needing per-font ascent metrics.
 */
interface BandGlyph {
  s: number
  ux: number
  uy: number
}

/**
 * Arc-length span [start, end] the glyphs actually cover. On a closed path the
 * run can straddle the seam (s=0), so a plain [min,max] would trace the empty
 * COMPLEMENT arc ("huge empty band over the top of the circle"). Take the
 * complement of the largest inter-glyph gap (including the wrap gap through the
 * seam); `end` may exceed length and wraps via pointAtArc.
 */
function glyphBandArc(gs: BandGlyph[], length: number, closed: boolean): [number, number] {
  const ss = gs.map((g) => g.s)
  if (!closed || ss.length <= 1) return [Math.min(...ss), Math.max(...ss)]
  ss.sort((a, b) => a - b)
  let maxGap = ss[0] + length - ss[ss.length - 1] // wrap gap (no straddle)
  let start = ss[0]
  let end = ss[ss.length - 1]
  for (let i = 0; i + 1 < ss.length; i++) {
    const gap = ss[i + 1] - ss[i]
    if (gap > maxGap) {
      maxGap = gap
      start = ss[i + 1]
      end = ss[i] + length // straddles: wrap forward through the seam
    }
  }
  return [start, end]
}

/** Up-vector of the glyph nearest arc position `s` (circular on closed paths). */
function nearestGlyphUp(
  gs: BandGlyph[],
  s: number,
  length: number,
  closed: boolean
): [number, number] {
  let ux = 0
  let uy = 0
  let best = Infinity
  for (const g of gs) {
    let ds = Math.abs(g.s - s)
    if (closed) ds = Math.min(ds, length - ds)
    if (ds < best) {
      best = ds
      ux = g.ux
      uy = g.uy
    }
  }
  return [ux, uy]
}

export function pathTextSelectionBand(
  data: TextPathData,
  box: Rect,
  glyphs: readonly Pick<DerivedTextGlyph, 'x' | 'y' | 'fontSize' | 'rotation'>[] | null | undefined,
  // Callers that already sampled this data/box (the selection overlay) pass it
  // in to avoid re-sampling the curve every repaint.
  presampled?: SampledPath | null
): number[] | null {
  if (!glyphs?.length) return null
  const sampled = presampled ?? sampleTextPath(data, box)
  if (!sampled) return null
  const { length } = sampled

  // Each glyph → its arc-length position on the path + its ascender ("up")
  // direction (from the glyph rotation). Positions pick the arc the band spans;
  // up-vectors pick which side of the baseline to inflate toward.
  const gs: BandGlyph[] = []
  let fontSize = 0
  for (const g of glyphs) {
    const rot = g.rotation ?? 0
    gs.push({ s: nearestArcPoint(sampled, g.x, g.y).s, ux: -Math.sin(rot), uy: -Math.cos(rot) })
    fontSize = Math.max(fontSize, g.fontSize || 0)
  }
  if (!(fontSize > 0)) return null

  const [arcStart, arcEnd] = glyphBandArc(gs, length, sampled.closed)
  // Pad so the first/last glyph bodies are covered; clamp to one full loop so a
  // near-complete circle doesn't overlap itself at the seam.
  const sStart = arcStart - fontSize * 0.3
  const span = Math.min(arcEnd + fontSize * 0.3 - sStart, length)
  if (!(span > 0)) return null

  const capH = fontSize * 0.72 // out to ~cap height
  const descH = fontSize * 0.14 // in to ~descender

  const steps = 48
  const outer: number[] = []
  const inner: number[] = []
  for (let i = 0; i <= steps; i++) {
    const p = pointAtArc(sampled, sStart + (span * i) / steps)
    // Offset direction from the NEAREST glyph's up-vector — not a global average,
    // which for text wrapping most of a circle cancels to ~0 and flips the sign
    // test, spawning a stray detached quad.
    const [ux, uy] = nearestGlyphUp(gs, p.s, length, sampled.closed)
    let nx = -p.ty
    let ny = p.tx
    if (nx * ux + ny * uy < 0) {
      nx = -nx
      ny = -ny
    }
    outer.push(p.x + nx * capH, p.y + ny * capH)
    inner.push(p.x - nx * descH, p.y - ny * descH)
  }
  const poly = outer.slice()
  for (let i = inner.length - 2; i >= 0; i -= 2) poly.push(inner[i], inner[i + 1])
  return poly
}
