import { polygonOutline } from '../polygon'
import type { Vector } from '../primitives'
import type { SceneNode, WindingRule } from '../types'
import {
  arcPoints,
  blobContours,
  commandContours,
  loopPoints,
  segmentPoints,
  segmentRuns
} from './flatten'

/** Contours filled together under one winding rule. */
export interface OutlineArea {
  windingRule: WindingRule
  contours: Vector[][]
}

/**
 * A shape's geometry in its own coordinates, curves flattened: the areas its fills cover and the
 * lines its strokes follow, closed contours ending where they began.
 */
export interface ShapeOutline {
  areas: OutlineArea[]
  lines: Vector[][]
  /** Each line's own stroke weight, where sides differ, as a rectangle's independent borders. */
  lineWeights?: number[]
  /**
   * Strokes centre on the lines whatever their alignment, as on a network without regions that is
   * open or has no saved stroke geometry.
   */
  strokeCentered?: boolean
  /** For each line, whether its start and its end are open ends, where a stroke's cap is drawn. */
  lineEnds?: Array<[boolean, boolean]>
  /** The saved outline a stroke fills, for a shape whose stroke has no lines to follow. */
  strokeAreas?: OutlineArea[]
}

function closed(contour: Vector[]): Vector[] {
  const first = contour.at(0)
  const last = contour.at(-1)
  if (!first || !last || (first.x === last.x && first.y === last.y)) return contour
  return [...contour, first]
}

function fromContours(contours: Vector[][], windingRule: WindingRule = 'NONZERO'): ShapeOutline {
  return { areas: [{ windingRule, contours }], lines: contours.map(closed) }
}

function cornerRadii(node: SceneNode): [number, number, number, number] {
  const radii: [number, number, number, number] = node.independentCorners
    ? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius]
    : [node.cornerRadius, node.cornerRadius, node.cornerRadius, node.cornerRadius]
  const limit = Math.min(node.width, node.height) / 2
  return radii.map((radius) => Math.max(0, Math.min(radius, limit))) as typeof radii
}

function rectangleContour(node: SceneNode, tolerance: number): Vector[] {
  const { width: w, height: h } = node
  const [tl, tr, br, bl] = cornerRadii(node)
  const corner = (cx: number, cy: number, r: number, from: number): Vector[] =>
    r > 0 ? arcPoints(cx, cy, r, r, from, from + Math.PI / 2, tolerance) : [{ x: cx, y: cy }]
  return [
    ...corner(w - tr, tr, tr, -Math.PI / 2),
    ...corner(w - br, h - br, br, 0),
    ...corner(bl, h - bl, bl, Math.PI / 2),
    ...corner(tl, tl, tl, Math.PI)
  ]
}

/**
 * A rectangle's four sides with the weight each draws its border at: top, right, bottom, left.
 * Each side runs from the middle of one rounded corner to the middle of the next, as its border
 * is drawn round them.
 */
function rectangleSides(
  node: SceneNode,
  tolerance: number
): Pick<ShapeOutline, 'lines' | 'lineWeights'> {
  const { width: w, height: h } = node
  const [tl, tr, br, bl] = cornerRadii(node)
  const quarter = Math.PI / 4
  const arc = (cx: number, cy: number, r: number, from: number): Vector[] =>
    r > 0 ? arcPoints(cx, cy, r, r, from, from + quarter, tolerance) : [{ x: cx, y: cy }]
  return {
    lines: [
      [...arc(tl, tl, tl, 5 * quarter), ...arc(w - tr, tr, tr, -2 * quarter)],
      [...arc(w - tr, tr, tr, -quarter), ...arc(w - br, h - br, br, 0)],
      [...arc(w - br, h - br, br, quarter), ...arc(bl, h - bl, bl, 2 * quarter)],
      [...arc(bl, h - bl, bl, 3 * quarter), ...arc(tl, tl, tl, 4 * quarter)]
    ],
    lineWeights: [
      node.borderTopWeight,
      node.borderRightWeight,
      node.borderBottomWeight,
      node.borderLeftWeight
    ]
  }
}

const FULL_TURN = Math.PI * 2

function ellipseContours(node: SceneNode, tolerance: number): Vector[][] {
  const rx = node.width / 2
  const ry = node.height / 2
  const arc = node.arcData
  const start = arc?.startingAngle ?? 0
  const end = arc?.endingAngle ?? FULL_TURN
  const inner = arc?.innerRadius ?? 0
  const whole = Math.abs(end - start) >= FULL_TURN - 1e-6
  const outer = arcPoints(rx, ry, rx, ry, start, whole ? start + FULL_TURN : end, tolerance)
  if (inner <= 0) return [whole ? outer : [{ x: rx, y: ry }, ...outer]]
  const hole = arcPoints(
    rx,
    ry,
    rx * inner,
    ry * inner,
    whole ? start + FULL_TURN : end,
    start,
    tolerance
  )
  // A whole ring is two loops wound opposite ways; a part ring is one outline across its ends.
  return whole ? [outer, hole] : [[...outer, ...hole]]
}

function vectorOutline(node: SceneNode, tolerance: number): ShapeOutline | null {
  const network = node.vectorNetwork
  const geometry = node.fillGeometry.map((path) => ({
    windingRule: path.windingRule,
    contours: path.commandsBlob.length > 0 ? blobContours(path.commandsBlob, tolerance) : []
  }))
  if (!network) {
    if (geometry.length === 0 && node.strokeGeometry.length === 0) return null
    // Without a network the renderer fills the saved stroke geometry, or draws no stroke.
    const strokeAreas = node.strokeGeometry.map((path) => ({
      windingRule: path.windingRule,
      contours: path.commandsBlob.length > 0 ? blobContours(path.commandsBlob, tolerance) : []
    }))
    return { areas: geometry, lines: [], strokeAreas }
  }
  // A vertex on one segment only is an open end.
  const degree = new Map<number, number>()
  for (const segment of network.segments) {
    degree.set(segment.start, (degree.get(segment.start) ?? 0) + 1)
    degree.set(segment.end, (degree.get(segment.end) ?? 0) + 1)
  }
  const lines: Vector[][] = []
  const lineEnds: Array<[boolean, boolean]> = []
  for (const [index, segment] of network.segments.entries()) {
    const points = segmentPoints(network, index, tolerance)
    if (!points) continue
    lines.push(points)
    lineEnds.push([degree.get(segment.start) === 1, degree.get(segment.end) === 1])
  }
  // Without regions the stroke draws centred on each segment, unless a closed network carries
  // saved stroke geometry, which the renderer draws with its alignment.
  const open = lineEnds.some(([start, end]) => start || end)
  const strokeCentered = network.regions.length === 0 && (open || node.strokeGeometry.length === 0)
  if (geometry.length > 0) return { areas: geometry, lines, lineEnds, strokeCentered }
  const areas =
    network.regions.length > 0
      ? network.regions.map((region) => ({
          windingRule: region.windingRule,
          contours: region.loops.map((loop) => loopPoints(network, loop, tolerance))
        }))
      : // Without regions a fill closes each run of segments, as a path fill does.
        [{ windingRule: 'NONZERO' as const, contours: segmentRuns(network, tolerance) }]
  return { areas, lines, lineEnds, strokeCentered }
}

/**
 * The outline a click is tested against, in the node's own coordinates, with curves within
 * `tolerance` of the shape; null for layers tested by their box, such as text.
 */
export function shapeOutline(node: SceneNode, tolerance: number): ShapeOutline | null {
  switch (node.type) {
    case 'RECTANGLE':
    case 'ROUNDED_RECTANGLE': {
      const outline = fromContours([rectangleContour(node, tolerance)])
      return node.independentStrokeWeights
        ? { ...outline, ...rectangleSides(node, tolerance) }
        : outline
    }
    case 'ELLIPSE': {
      if (node.fillGeometry.length > 0) return vectorOutline(node, tolerance)
      return fromContours(ellipseContours(node, tolerance))
    }
    case 'POLYGON':
    case 'STAR':
      return fromContours(commandContours(polygonOutline(node), tolerance))
    case 'LINE':
      return {
        areas: [],
        lines: [
          [
            { x: 0, y: 0 },
            { x: node.width, y: node.height }
          ]
        ],
        lineEnds: [[true, true]]
      }
    case 'VECTOR':
      return vectorOutline(node, tolerance)
    default:
      return null
  }
}
