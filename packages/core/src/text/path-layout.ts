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

function pointAtArc(path: SampledPath, sIn: number): PathPoint {
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
