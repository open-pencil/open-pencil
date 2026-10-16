import { polygonVertices, strokeOverflow } from './geometry'
import type { Vector } from './primitives'
import type { SceneNode, VectorNetwork, VectorSegment, WindingRule } from './types'

const CURVE_STEPS = 16
const FULL_TURN = Math.PI * 2
const ANGLE_EPSILON = 1e-6

interface FlattenedRegion {
  windingRule: WindingRule
  loops: Vector[][]
}

interface FlattenedNetwork {
  regions: FlattenedRegion[]
  segments: Vector[][]
}

const flattenedNetworks = new WeakMap<VectorNetwork, FlattenedNetwork>()

function hasVisibleFill(node: SceneNode): boolean {
  return node.fills.some((fill) => fill.visible)
}

function hasVisibleStroke(node: SceneNode): boolean {
  return node.strokes.some((stroke) => stroke.visible && stroke.weight > 0)
}

/** How far the painted strokes reach past the shape's outline, in node units. */
function strokeReach(node: SceneNode): number {
  return strokeOverflow(node.strokes, undefined, node.vectorNetwork)
}

/** How far a stroked line paints to either side of a vector's path, in node units. */
function lineReach(node: SceneNode): number {
  let halfWeight = 0
  for (const stroke of node.strokes)
    if (stroke.visible) halfWeight = Math.max(halfWeight, stroke.weight / 2)
  return Math.max(halfWeight, strokeReach(node))
}

function sampleSegment(network: VectorNetwork, segment: VectorSegment, forward: boolean): Vector[] {
  const a = network.vertices.at(segment.start)
  const b = network.vertices.at(segment.end)
  if (!a || !b) return []
  const straight =
    segment.tangentStart.x === 0 &&
    segment.tangentStart.y === 0 &&
    segment.tangentEnd.x === 0 &&
    segment.tangentEnd.y === 0
  const points: Vector[] = []
  const steps = straight ? 1 : CURVE_STEPS
  for (let i = 0; i <= steps; i++) {
    const t = forward ? i / steps : 1 - i / steps
    const u = 1 - t
    const c1x = a.x + segment.tangentStart.x
    const c1y = a.y + segment.tangentStart.y
    const c2x = b.x + segment.tangentEnd.x
    const c2y = b.y + segment.tangentEnd.y
    points.push({
      x: u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b.y
    })
  }
  return points
}

/** A region loop as one closed outline, following each segment in the direction the loop walks it. */
function loopOutline(network: VectorNetwork, loop: number[]): Vector[] {
  const outline: Vector[] = []
  let current: number | null = null
  loop.forEach((segmentIndex, i) => {
    const segment = network.segments.at(segmentIndex)
    if (!segment) return
    let forward: boolean
    if (current === null) {
      const next = network.segments.at(loop[(i + 1) % loop.length])
      forward = !next || next === segment || next.start === segment.end || next.end === segment.end
    } else {
      forward = segment.start === current
    }
    outline.push(...sampleSegment(network, segment, forward))
    current = forward ? segment.end : segment.start
  })
  return outline
}

function flattenNetwork(network: VectorNetwork): FlattenedNetwork {
  const cached = flattenedNetworks.get(network)
  if (cached) return cached
  const flattened: FlattenedNetwork = {
    regions: network.regions.map((region) => ({
      windingRule: region.windingRule,
      loops: region.loops.map((loop) => loopOutline(network, loop))
    })),
    segments: network.segments.map((segment) => sampleSegment(network, segment, true))
  }
  flattenedNetworks.set(network, flattened)
  return flattened
}

/** Signed crossings of a closed outline around the point (nonzero winding number). */
function windingNumber(outline: Vector[], x: number, y: number): number {
  let winding = 0
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
    const side = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y)
    if (a.y <= y) {
      if (b.y > y && side > 0) winding++
    } else if (b.y <= y && side < 0) {
      winding--
    }
  }
  return winding
}

function regionContains(region: FlattenedRegion, x: number, y: number): boolean {
  let winding = 0
  for (const loop of region.loops) winding += windingNumber(loop, x, y)
  return region.windingRule === 'EVENODD' ? winding % 2 !== 0 : winding !== 0
}

function distanceToSegment(x: number, y: number, a: Vector, b: Vector): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared))
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy))
}

function nearPolyline(
  points: Vector[],
  x: number,
  y: number,
  tolerance: number,
  closed: boolean
): boolean {
  const count = closed ? points.length : points.length - 1
  for (let i = 0; i < count; i++) {
    if (distanceToSegment(x, y, points[i], points[(i + 1) % points.length]) <= tolerance)
      return true
  }
  return false
}

function vectorContains(
  node: SceneNode,
  network: VectorNetwork,
  x: number,
  y: number,
  pad: number
): boolean | null {
  const filled = hasVisibleFill(node)
  const stroked = hasVisibleStroke(node)
  if (!filled && !stroked) return null
  const flattened = flattenNetwork(network)
  if (filled) {
    // The renderer closes and fills open chains itself; their box stays the target.
    if (flattened.regions.length === 0) return null
    if (flattened.regions.some((region) => regionContains(region, x, y))) return true
  }
  const tolerance = pad + lineReach(node)
  return flattened.segments.some((points) => nearPolyline(points, x, y, tolerance, false))
}

function isFullEllipse(node: SceneNode): boolean {
  const arc = node.arcData
  if (!arc) return true
  const sweep = Math.abs(arc.endingAngle - arc.startingAngle)
  return arc.innerRadius === 0 && sweep >= FULL_TURN - ANGLE_EPSILON
}

function ellipseContains(node: SceneNode, x: number, y: number, pad: number): boolean | null {
  if (!isFullEllipse(node)) return null
  const rx = node.width / 2
  const ry = node.height / 2
  if (rx <= 0 || ry <= 0) return null
  const reach = pad + strokeReach(node)
  const nx = (x - rx) / (rx + reach)
  const ny = (y - ry) / (ry + reach)
  return nx * nx + ny * ny <= 1
}

function cornerRadii(node: SceneNode): [number, number, number, number] {
  const limit = Math.min(node.width, node.height) / 2
  const radii = node.independentCorners
    ? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius]
    : [node.cornerRadius, node.cornerRadius, node.cornerRadius, node.cornerRadius]
  const [tl, tr, br, bl] = radii.map((radius) => Math.max(0, Math.min(radius, limit)))
  return [tl, tr, br, bl]
}

function roundedRectContains(node: SceneNode, x: number, y: number, pad: number): boolean | null {
  const [tl, tr, br, bl] = cornerRadii(node)
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) return null
  const reach = pad + strokeReach(node)
  const { width: w, height: h } = node
  const corners = [
    { r: tl, cx: tl, cy: tl, inside: x < tl && y < tl },
    { r: tr, cx: w - tr, cy: tr, inside: x > w - tr && y < tr },
    { r: br, cx: w - br, cy: h - br, inside: x > w - br && y > h - br },
    { r: bl, cx: bl, cy: h - bl, inside: x < bl && y > h - bl }
  ]
  return corners.every(
    ({ r, cx, cy, inside }) => !inside || r === 0 || Math.hypot(x - cx, y - cy) <= r + reach
  )
}

function polygonContains(node: SceneNode, x: number, y: number, pad: number): boolean {
  const outline = polygonVertices(node)
  if (windingNumber(outline, x, y) !== 0) return true
  return nearPolyline(outline, x, y, pad + strokeReach(node), true)
}

/**
 * Whether a point in the node's local space lies on the shape it draws, allowing `pad` canvas
 * units around the outline (and the strokes' reach). Closed shapes (ellipses, rounded rectangles,
 * polygons, stars) count their whole outline whatever their paint, as their hover outline does; a
 * vector counts its filled regions and, along its path, its stroke. Returns `null` when the node's
 * box is its shape, so callers keep their box test: frames, text, images, partial ellipses, square
 * corners, and vectors without visible paint or with only open filled chains.
 */
export function shapeContainsLocalPoint(
  node: SceneNode,
  x: number,
  y: number,
  pad: number
): boolean | null {
  switch (node.type) {
    case 'ELLIPSE':
      return ellipseContains(node, x, y, pad)
    case 'RECTANGLE':
    case 'ROUNDED_RECTANGLE':
      return roundedRectContains(node, x, y, pad)
    case 'POLYGON':
    case 'STAR':
      return polygonContains(node, x, y, pad)
    case 'VECTOR':
      return node.vectorNetwork ? vectorContains(node, node.vectorNetwork, x, y, pad) : null
    default:
      return null
  }
}
