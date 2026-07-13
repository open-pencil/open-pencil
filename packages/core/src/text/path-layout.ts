/**
 * Text-on-path reflow for imported Figma TEXT_PATH nodes.
 *
 * The .fig carries the layout path (`rawNodeFields.vectorData`, in
 * `normalizedSize` space) and the start param (`textPathStart`). Figma's
 * resize behavior is re-layout at constant font size: the path scales with
 * the node, glyph outlines do not distort, and the text re-wraps.
 *
 * We reproduce that WITHOUT font files by re-placing the imported glyph
 * outlines: calibrate per-glyph layout parameters from the current baked
 * positions (arc position deltas, signed normal offset, rotation phase vs
 * the local tangent — all constant under constant font size), then
 * re-evaluate them on the scaled path. At identity scale reflow returns the
 * baked positions exactly; calibrated on DomeSticker where measured phase
 * is ±0.02 rad and the normal offset is constant to <0.1px across glyphs.
 */
import type { FigmaDerivedTextGlyph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { decodeVectorNetworkBlob } from '#core/vector'

export interface TextPathData {
  network: VectorNetwork
  normalizedSize: Vector
  tValue: number
  forward: boolean
}

interface RawTextPathFields {
  vectorData?: { vectorNetworkBlob?: unknown; normalizedSize?: Vector }
  textPathStart?: { tValue?: number; forward?: boolean }
}

/** rawNodeFields wraps materialized blobs — see preserveFigmaPayloadBlobs. */
function unwrapRawBlob(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value
  if (value && typeof value === 'object') {
    const inner = (value as { __openPencilFigmaBlob?: unknown }).__openPencilFigmaBlob
    if (inner instanceof Uint8Array) return inner
  }
  return null
}

/** Read the layout path preserved on an imported TEXT_PATH node. */
export function getTextPathData(node: SceneNode): TextPathData | null {
  if (node.source.fig.kiwiNodeType !== 'TEXT_PATH') return null
  const raw = node.source.fig.rawNodeFields as RawTextPathFields
  const blob = unwrapRawBlob(raw.vectorData?.vectorNetworkBlob)
  const normalizedSize = raw.vectorData?.normalizedSize
  if (!blob) return null
  if (!normalizedSize || normalizedSize.x <= 0 || normalizedSize.y <= 0) return null
  try {
    const network = decodeVectorNetworkBlob(blob)
    if (network.segments.length === 0 || network.vertices.length === 0) return null
    return {
      network,
      normalizedSize,
      tValue: raw.textPathStart?.tValue ?? 0,
      forward: raw.textPathStart?.forward ?? true
    }
  } catch {
    return null
  }
}

// --- Arc-length sampled path ---

const SAMPLES_PER_SEGMENT = 256

interface SampledPath {
  xs: Float64Array
  ys: Float64Array
  /** Cumulative arc length per sample; cum[n-1] is the total length. */
  cum: Float64Array
  length: number
  closed: boolean
}

/** Sample the path's cubic segments into node-local space inside `box`. */
export function sampleTextPath(data: TextPathData, box: Rect): SampledPath | null {
  const sx = box.width / data.normalizedSize.x
  const sy = box.height / data.normalizedSize.y
  const segs = data.network.segments
  const verts = data.network.vertices
  const n = segs.length * SAMPLES_PER_SEGMENT + 1
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  let w = 0
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si]
    // .at() types as possibly-undefined: malformed imports can hold stale indices.
    const a = verts.at(seg.start)
    const b = verts.at(seg.end)
    if (!a || !b) return null
    const c1x = a.x + seg.tangentStart.x
    const c1y = a.y + seg.tangentStart.y
    const c2x = b.x + seg.tangentEnd.x
    const c2y = b.y + seg.tangentEnd.y
    const last = si === segs.length - 1
    const count = last ? SAMPLES_PER_SEGMENT + 1 : SAMPLES_PER_SEGMENT
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLES_PER_SEGMENT
      const mt = 1 - t
      const nx = mt * mt * mt * a.x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * b.x
      const ny = mt * mt * mt * a.y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * b.y
      xs[w] = box.x + nx * sx
      ys[w] = box.y + ny * sy
      w++
    }
  }
  const cum = new Float64Array(n)
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])
  }
  const length = cum[n - 1]
  if (!(length > 0)) return null
  const closed = Math.hypot(xs[n - 1] - xs[0], ys[n - 1] - ys[0]) < length / n + 1e-6
  return { xs, ys, cum, length, closed }
}

interface PathPoint {
  x: number
  y: number
  /** Unit tangent along increasing arc length. */
  tx: number
  ty: number
  s: number
}

/**
 * Node-local point (+ unit tangent along increasing arc length) at absolute
 * arc length `sIn`. Shared by layout and the selection overlay's start marker
 * (pass `fraction * path.length`). Callers already holding a sampled path use
 * this directly rather than re-sampling.
 */
export function pointAtArc(path: SampledPath, sIn: number): PathPoint {
  let s = sIn
  if (path.closed) {
    s = ((s % path.length) + path.length) % path.length
  } else {
    s = Math.min(Math.max(s, 0), path.length)
  }
  // Binary search for the sample interval containing s.
  let lo = 0
  let hi = path.cum.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (path.cum[mid] <= s) lo = mid
    else hi = mid
  }
  const span = path.cum[hi] - path.cum[lo]
  const f = span > 0 ? (s - path.cum[lo]) / span : 0
  const x = path.xs[lo] + (path.xs[hi] - path.xs[lo]) * f
  const y = path.ys[lo] + (path.ys[hi] - path.ys[lo]) * f
  // Tangent from a slightly wider window for stability.
  const a = Math.max(0, lo - 1)
  const b = Math.min(path.cum.length - 1, hi + 1)
  let tx = path.xs[b] - path.xs[a]
  let ty = path.ys[b] - path.ys[a]
  const m = Math.hypot(tx, ty) || 1
  tx /= m
  ty /= m
  return { x, y, tx, ty, s }
}

function nearestArcPoint(path: SampledPath, px: number, py: number): PathPoint {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < path.xs.length; i++) {
    const dx = path.xs[i] - px
    const dy = path.ys[i] - py
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const p = pointAtArc(path, path.cum[best])
  // Refine along the tangent so s has sub-sample accuracy.
  const along = (px - p.x) * p.tx + (py - p.y) * p.ty
  return pointAtArc(path, p.s + along)
}

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
  glyphs: FigmaDerivedTextGlyph[],
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
): FigmaDerivedTextGlyph[] | null {
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
  glyphs: FigmaDerivedTextGlyph[],
  data: TextPathData,
  layout: PathTextLayout,
  box: Rect
): FigmaDerivedTextGlyph[] | null {
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

/**
 * Node-local box that maps the layout path onto the glyph baselines.
 *
 * `SceneNode.textPathBox` is ~4% too small (import maps the path onto the node's
 * ORIGINAL Figma box, not its own normalizedSize space), so a path sampled from
 * it sits ~30px off the lettering. This recovers the box that lands the path ON
 * the glyphs, for display (the selection overlay) without disturbing the
 * import/reflow use of textPathBox.
 *
 * It fits from `box0` (the node's current textPathBox) so the box **aspect ratio
 * is preserved** — after a non-uniform resize textPathBox is an oval, and the
 * overlay must oval with it (using normalizedSize would force a circle). Only a
 * uniform scale (about box0's centre) + translation are fit — a 3-DOF similarity
 * that corrects the ~4% and repositions without over-fitting the arc. Returns
 * null with no glyphs, a degenerate box, or an unsampleable path.
 */
export function fitTextPathBoxToGlyphs(
  data: TextPathData,
  box0: Rect,
  glyphs: readonly Pick<FigmaDerivedTextGlyph, 'x' | 'y'>[] | null | undefined
): Rect | null {
  if (!glyphs?.length) return null
  const bw = box0.width
  const bh = box0.height
  if (!(bw > 0) || !(bh > 0)) return null
  const ref = sampleTextPath(data, box0)
  if (!ref) return null

  const cx0 = box0.x + bw / 2
  const cy0 = box0.y + bh / 2
  let c = 1
  let tx = 0
  let ty = 0
  for (let iter = 0; iter < 8; iter++) {
    // Least-squares uniform-scale + translation over the current correspondence:
    // a transformed ref point is P = centre + c·(ref − centre) + t, so minimising
    // |g − P|² gives c = cov(a,b)/var(a), t = mean(b) − c·mean(a).
    let saa = 0
    let sab = 0
    let sax = 0
    let say = 0
    let sbx = 0
    let sby = 0
    for (const g of glyphs) {
      let bestD = Infinity
      let ai = 0
      let aj = 0
      for (let i = 0; i < ref.xs.length; i++) {
        const px = cx0 + c * (ref.xs[i] - cx0) + tx
        const py = cy0 + c * (ref.ys[i] - cy0) + ty
        const d = (px - g.x) ** 2 + (py - g.y) ** 2
        if (d < bestD) {
          bestD = d
          ai = ref.xs[i] - cx0
          aj = ref.ys[i] - cy0
        }
      }
      const bx = g.x - cx0
      const by = g.y - cy0
      saa += ai * ai + aj * aj
      sab += ai * bx + aj * by
      sax += ai
      say += aj
      sbx += bx
      sby += by
    }
    const n = glyphs.length
    const aBarX = sax / n
    const aBarY = say / n
    const bBarX = sbx / n
    const bBarY = sby / n
    const varA = saa - n * (aBarX * aBarX + aBarY * aBarY)
    const covAB = sab - n * (aBarX * bBarX + aBarY * bBarY)
    const newC = varA > 1e-6 ? covAB / varA : c
    const newTx = bBarX - newC * aBarX
    const newTy = bBarY - newC * aBarY
    const converged =
      Math.abs(newC - c) < 1e-4 && Math.abs(newTx - tx) < 0.05 && Math.abs(newTy - ty) < 0.05
    c = newC
    tx = newTx
    ty = newTy
    if (converged) break
  }
  // Guard a degenerate fit from exploding the box.
  c = Math.min(Math.max(c, 0.5), 2)
  return {
    x: cx0 - (bw * c) / 2 + tx,
    y: cy0 - (bh * c) / 2 + ty,
    width: bw * c,
    height: bh * c
  }
}

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

/** Arc length of the sampled point nearest (px, py). */
function nearestSampleArc(sampled: SampledPath, px: number, py: number): number {
  const { xs, ys, cum } = sampled
  let best = Infinity
  let bi = 0
  for (let i = 0; i < xs.length; i++) {
    const d = (xs[i] - px) ** 2 + (ys[i] - py) ** 2
    if (d < best) {
      best = d
      bi = i
    }
  }
  return cum[bi]
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
  glyphs:
    | readonly Pick<FigmaDerivedTextGlyph, 'x' | 'y' | 'fontSize' | 'rotation'>[]
    | null
    | undefined,
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
    gs.push({ s: nearestSampleArc(sampled, g.x, g.y), ux: -Math.sin(rot), uy: -Math.cos(rot) })
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
