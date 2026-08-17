import type { DerivedTextGlyph, TextPathData } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { nearestArcPoint, pointAtArc, sampleTextPath, type PathPoint } from './sampling'

// --- Calibrated layout ---

export interface PathTextLayout {
  /** Arc position of glyph 0 as a fraction of total length. */
  anchor: number
  /** Per-glyph arc offset from glyph 0, px (constant at constant font size). */
  deltas: number[]
  /** Per-glyph signed offset along the left normal (-ty, tx), px. */
  offsets: number[]
  /** Per-glyph rotation minus the tangent-derived base rotation, radians. */
  phases: number[]
}

const TWO_PI = Math.PI * 2

function normalizeAngle(a: number): number {
  let r = a % TWO_PI
  if (r > Math.PI) r -= TWO_PI
  if (r < -Math.PI) r += TWO_PI
  return r
}

/** Rotation implied by the path direction at a point (paint negates it). */
function baseRotation(p: PathPoint, forward: boolean): number {
  const tx = forward ? p.tx : -p.tx
  const ty = forward ? p.ty : -p.ty
  return -Math.atan2(ty, tx)
}

/**
 * Measure layout parameters from the node's current baked glyph baselines.
 * Reflowing with these on the same box reproduces the input exactly.
 */
export function calibratePathTextLayout(
  glyphs: DerivedTextGlyph[],
  data: TextPathData,
  box: Rect
): PathTextLayout | null {
  if (glyphs.length === 0) return null
  const path = sampleTextPath(data, box)
  if (!path) return null

  const positions: PathPoint[] = []
  const offsets: number[] = []
  const phases: number[] = []
  for (const g of glyphs) {
    const p = nearestArcPoint(path, g.x, g.y)
    // Signed distance along the left normal (-ty, tx).
    const off = (g.x - p.x) * -p.ty + (g.y - p.y) * p.tx
    positions.push(p)
    offsets.push(off)
    phases.push(normalizeAngle((g.rotation ?? 0) - baseRotation(p, data.forward)))
  }

  const s0 = positions[0].s
  const deltas = positions.map((p) => {
    let d = p.s - s0
    // On closed paths pick the wrap that matches travel direction.
    if (path.closed) {
      if (data.forward && d < -path.length / 2) d += path.length
      if (!data.forward && d > path.length / 2) d -= path.length
    }
    return d
  })
  return { anchor: s0 / path.length, deltas, offsets, phases }
}

/**
 * Re-place glyphs along the path scaled into `box` at constant font size:
 * the anchor keeps its normalized arc position, per-glyph arc deltas and
 * normal offsets are preserved, rotation follows the new local tangent.
 */
/**
 * Lay out fresh glyph outlines along the path with a pen walk: glyph 0 sits
 * at `anchor` (fraction of total length), each next glyph advances by
 * advance * fontSize (advances are in em units) along the travel direction,
 * offset along the left normal by `offset`. Used when the characters change
 * and the baked per-glyph deltas no longer apply.
 */
export function layoutPathTextFromAdvances(
  data: TextPathData,
  box: Rect,
  anchor: number,
  offset: number,
  glyphSources: Array<{ commandsBlob: Uint8Array; fontSize: number; advance: number }>
): DerivedTextGlyph[] | null {
  const path = sampleTextPath(data, box)
  if (!path) return null
  const dir = data.forward ? 1 : -1
  let s = anchor * path.length
  return glyphSources.map((src) => {
    const p = pointAtArc(path, s)
    s += dir * src.advance * src.fontSize
    return {
      commandsBlob: src.commandsBlob,
      x: p.x + -p.ty * offset,
      y: p.y + p.tx * offset,
      fontSize: src.fontSize,
      rotation: normalizeAngle(baseRotation(p, data.forward))
    }
  })
}

export function reflowPathTextGlyphs(
  glyphs: DerivedTextGlyph[],
  data: TextPathData,
  layout: PathTextLayout,
  box: Rect
): DerivedTextGlyph[] | null {
  if (glyphs.length !== layout.deltas.length) return null
  const path = sampleTextPath(data, box)
  if (!path) return null
  const s0 = layout.anchor * path.length
  return glyphs.map((g, i) => {
    const p = pointAtArc(path, s0 + layout.deltas[i])
    const off = layout.offsets[i]
    return {
      ...g,
      commandsBlob: new Uint8Array(g.commandsBlob),
      x: p.x + -p.ty * off,
      y: p.y + p.tx * off,
      rotation: normalizeAngle(baseRotation(p, data.forward) + layout.phases[i]),
      // Reflow replaces geometric scaling entirely.
      scaleX: undefined,
      scaleY: undefined
    }
  })
}
