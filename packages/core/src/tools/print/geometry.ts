/**
 * Die-line geometry from flat pieces. A product is a set of polygons laid out on the sheet; an
 * edge two pieces share is a fold (crease) and an edge only one piece has is a cut. Holes and
 * slits are extra cut paths. All lengths are millimetres from the trim box's top-left corner.
 */

export type Point = readonly [number, number]

export interface Piece {
  name: string
  points: readonly Point[]
}

export interface Panel {
  name: string
  x: number
  y: number
  width: number
  height: number
}

export interface DieLine {
  /** Trim box size: the bounding box of every piece. */
  width: number
  height: number
  cuts: string[]
  creases: string[]
  panels: Panel[]
}

const EPS = 1e-6

/** Millimetres to points (1/72 inch), the canvas unit for print, as A4 is 595 × 842. */
export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

export function rect(name: string, x: number, y: number, width: number, height: number): Piece {
  return {
    name,
    points: [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ]
  }
}

function key(p: Point): string {
  return `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`
}

function edgeKey(a: Point, b: Point): string {
  const ka = key(a)
  const kb = key(b)
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

function segment(a: Point, b: Point): string {
  return `M${fmt(a[0])} ${fmt(a[1])} L${fmt(b[0])} ${fmt(b[1])}`
}

/**
 * Splits every edge at the vertices other pieces put on it, so an edge shared only in part (a
 * flap narrower than its panel) still cancels where the two touch.
 */
function splitEdges(pieces: readonly Piece[]): [Point, Point][] {
  const vertices = pieces.flatMap((piece) => piece.points)
  const edges: [Point, Point][] = []
  for (const piece of pieces) {
    const pts = piece.points
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const len2 = dx * dx + dy * dy
      if (len2 < EPS) continue
      const cuts = vertices
        .map((v) => {
          const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / len2
          const px = a[0] + t * dx
          const py = a[1] + t * dy
          const onLine = Math.abs(px - v[0]) < 1e-4 && Math.abs(py - v[1]) < 1e-4
          return onLine && t > EPS && t < 1 - EPS ? t : null
        })
        .filter((t): t is number => t !== null)
      const ts = [0, ...new Set(cuts.map((t) => Math.round(t * 1e6) / 1e6)), 1].sort(
        (p, q) => p - q
      )
      for (let j = 0; j < ts.length - 1; j++) {
        edges.push([
          [a[0] + ts[j] * dx, a[1] + ts[j] * dy],
          [a[0] + ts[j + 1] * dx, a[1] + ts[j + 1] * dy]
        ])
      }
    }
  }
  return edges
}

/** Joins collinear touching segments so a straight cut is one path, not many short ones. */
function mergeCollinear(segments: [Point, Point][]): [Point, Point][] {
  const out = segments.map((s): [Point, Point] => [s[0], s[1]])
  const collinear = (p: Point, q: Point, r: Point) =>
    Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) < 1e-6
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const [a, b] = out[i]
      const [c, d] = out[j]
      // Find the shared end; the merged segment runs between the two far ends.
      let joined: [Point, Point] | null = null
      if (key(b) === key(c) && collinear(a, b, d)) joined = [a, d]
      else if (key(b) === key(d) && collinear(a, b, c)) joined = [a, c]
      else if (key(a) === key(c) && collinear(b, a, d)) joined = [b, d]
      else if (key(a) === key(d) && collinear(b, a, c)) joined = [b, c]
      if (!joined) continue
      out[i] = joined
      out.splice(j, 1)
      j = i // rescan against the longer segment
    }
  }
  return out
}

export function dieLine(
  pieces: readonly Piece[],
  extraCuts: readonly string[] = [],
  panelNames: readonly string[] = pieces.map((p) => p.name)
): DieLine {
  const counts = new Map<string, { a: Point; b: Point; n: number }>()
  for (const [a, b] of splitEdges(pieces)) {
    const k = edgeKey(a, b)
    const entry = counts.get(k)
    if (entry) entry.n++
    else counts.set(k, { a, b, n: 1 })
  }
  const cutSegs: [Point, Point][] = []
  const creaseSegs: [Point, Point][] = []
  for (const { a, b, n } of counts.values()) (n === 1 ? cutSegs : creaseSegs).push([a, b])

  const xs = pieces.flatMap((p) => p.points.map((q) => q[0]))
  const ys = pieces.flatMap((p) => p.points.map((q) => q[1]))
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const shift = (s: [Point, Point]): [Point, Point] => [
    [s[0][0] - minX, s[0][1] - minY],
    [s[1][0] - minX, s[1][1] - minY]
  ]
  const panels = pieces
    .filter((p) => panelNames.includes(p.name))
    .map((p) => {
      const px = p.points.map((q) => q[0])
      const py = p.points.map((q) => q[1])
      return {
        name: p.name,
        x: Math.min(...px) - minX,
        y: Math.min(...py) - minY,
        width: Math.max(...px) - Math.min(...px),
        height: Math.max(...py) - Math.min(...py)
      }
    })
  return {
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    cuts: [...mergeCollinear(cutSegs.map(shift)).map(([a, b]) => segment(a, b)), ...extraCuts],
    creases: mergeCollinear(creaseSegs.map(shift)).map(([a, b]) => segment(a, b)),
    panels
  }
}

/** A closed rounded rectangle, as one SVG path. */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.min(r, w / 2, h / 2)
  const c = k * 0.5523
  return [
    `M${fmt(x + k)} ${fmt(y)}`,
    `L${fmt(x + w - k)} ${fmt(y)}`,
    `C${fmt(x + w - k + c)} ${fmt(y)} ${fmt(x + w)} ${fmt(y + k - c)} ${fmt(x + w)} ${fmt(y + k)}`,
    `L${fmt(x + w)} ${fmt(y + h - k)}`,
    `C${fmt(x + w)} ${fmt(y + h - k + c)} ${fmt(x + w - k + c)} ${fmt(y + h)} ${fmt(x + w - k)} ${fmt(y + h)}`,
    `L${fmt(x + k)} ${fmt(y + h)}`,
    `C${fmt(x + k - c)} ${fmt(y + h)} ${fmt(x)} ${fmt(y + h - k + c)} ${fmt(x)} ${fmt(y + h - k)}`,
    `L${fmt(x)} ${fmt(y + k)}`,
    `C${fmt(x)} ${fmt(y + k - c)} ${fmt(x + k - c)} ${fmt(y)} ${fmt(x + k)} ${fmt(y)}`,
    'Z'
  ].join(' ')
}

export function circlePath(cx: number, cy: number, r: number): string {
  return roundedRectPath(cx - r, cy - r, 2 * r, 2 * r, r)
}
