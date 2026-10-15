import { BLACK } from '../constants'
import { getWorldMatrix } from '../coordinate'
import type { SceneGraph } from '../index'
import Matrix from '../matrix'
import type { Color, Vector } from '../primitives'
import type { ConnectorEndpoint, Fill, SceneNode, Stroke, VectorNetwork } from '../types'
import type { GeneratedFrameKind } from './kind'

/**
 * A FigJam connector as Figma draws it by default: a grey line 4 px wide with rounded elbows, a
 * round start, and an arrow at the end. Measured in FigJam.
 */
export const CONNECTOR_COLOR: Color = { r: 117 / 255, g: 117 / 255, b: 117 / 255, a: 1 }
export const CONNECTOR_STROKE_WEIGHT = 4
export const CONNECTOR_CORNER_RADIUS = 24

export function connectorStroke(color: Color = CONNECTOR_COLOR): Stroke {
  return {
    type: 'SOLID',
    color: { ...color },
    opacity: 1,
    visible: true,
    weight: CONNECTOR_STROKE_WEIGHT,
    align: 'CENTER',
    cap: 'ROUND',
    join: 'ROUND'
  }
}

export interface ConnectorSublayers {
  /** The routed line, a vector whose ends carry the connector's caps. */
  line: SceneNode
  /** The plate behind the label, which the line breaks around. */
  labelBackground: SceneNode
  label: SceneNode
}

/** A connector's line, label plate, and label, in drawing order. */
export function connectorSublayers(
  graph: SceneGraph,
  connector: SceneNode
): ConnectorSublayers | null {
  const children = graph.getChildren(connector.id)
  if (children.length !== 3) return null
  const [line, labelBackground, label] = children
  if (line.type !== 'VECTOR' || label.type !== 'TEXT') return null
  return { line, labelBackground, label }
}

/** FigJam keeps a connector's box to its route: it never turns or resizes on its own. */
export const CONNECTOR_KIND: GeneratedFrameKind = {
  complete: (graph, frame) => connectorSublayers(graph, frame) !== null,
  text: () => undefined,
  rotates: false,
  resizes: false,
  namedByText: false
}

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color: { ...color }, opacity, visible: true }
}

/** Adds a connector's sublayers to a CONNECTOR the caller created; its route comes later. */
export function buildConnectorSublayers(
  graph: SceneGraph,
  connector: SceneNode,
  overrides: Partial<Record<keyof ConnectorSublayers, Partial<SceneNode>>> = {}
): ConnectorSublayers {
  const empty: VectorNetwork = { vertices: [], segments: [], regions: [] }
  const line = graph.createNode('VECTOR', connector.id, {
    name: 'Line',
    vectorNetwork: empty,
    fills: [],
    strokes: [connectorStroke()],
    strokeWeight: CONNECTOR_STROKE_WEIGHT,
    cornerRadius: CONNECTOR_CORNER_RADIUS,
    ...overrides.line
  })
  const labelBackground = graph.createNode('RECTANGLE', connector.id, {
    name: 'Label background',
    fills: [solid({ r: 1, g: 1, b: 1, a: 1 })],
    cornerRadius: 3,
    visible: false,
    ...overrides.labelBackground
  })
  const label = graph.createNode('TEXT', connector.id, {
    name: 'Label',
    text: '',
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 16,
    lineHeight: 24,
    textAlignHorizontal: 'CENTER',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(BLACK)],
    visible: false,
    ...overrides.label
  })
  return { line, labelBackground, label }
}

/**
 * Where a connector's line starts and ends, in its parent's axes: the ends a connector keeps when
 * the layers it was attached to are gone.
 */
export function connectorRouteEnds(
  graph: SceneGraph,
  connector: SceneNode
): { start: Vector; end: Vector } | null {
  const line = connectorSublayers(graph, connector)?.line
  const vertices = line?.vectorNetwork?.vertices ?? []
  const first = vertices.at(0)
  const last = vertices.at(-1)
  if (!line || !first || !last) return null
  const at = (vertex: Vector) => ({
    x: connector.x + line.x + vertex.x,
    y: connector.y + line.y + vertex.y
  })
  return { start: at(first), end: at(last) }
}

/** A free connector end at a point in the connector's parent's axes. */
export function freeEndpoint(x: number, y: number): ConnectorEndpoint {
  return { nodeId: null, magnet: 'NONE', position: { x, y } }
}

/** A connector end bound to a layer, following it by `magnet`. */
export function boundEndpoint(
  nodeId: string,
  magnet: ConnectorEndpoint['magnet'] = 'AUTO'
): ConnectorEndpoint {
  return { nodeId, magnet, position: { x: 0, y: 0 } }
}

/** How far from a line, beyond half its stroke, a point still lands on it, in canvas units. */
const CONNECTOR_HIT_SLOP = 4
/** Points sampled along a curved segment to measure distance to it. */
const CURVE_SAMPLES = 24

function distanceToSegment(p: Vector, a: Vector, b: Vector): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function cubicPoint(a: Vector, c1: Vector, c2: Vector, b: Vector, t: number): Vector {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y
  }
}

/**
 * Whether a canvas point lands on a connector's line: within half its stroke and a few units of
 * slop, plus `pad`. A connector is picked by its line, not by the box around its route.
 */
export function hitsConnectorLine(
  graph: SceneGraph,
  connector: SceneNode,
  px: number,
  py: number,
  pad = 0
): boolean {
  const line = connectorSublayers(graph, connector)?.line
  const network = line?.vectorNetwork
  if (!line || !network) return false
  const inverse = Matrix.invert(getWorldMatrix(line, graph))
  if (!inverse) return false
  const [x, y] = Matrix.mapPoints(inverse, [px, py])
  const point = { x, y }
  const reach = (line.strokes[0]?.weight ?? line.strokeWeight) / 2 + CONNECTOR_HIT_SLOP + pad
  return network.segments.some((segment) => {
    const a = network.vertices[segment.start]
    const b = network.vertices[segment.end]
    const { tangentStart: ts, tangentEnd: te } = segment
    if (ts.x === 0 && ts.y === 0 && te.x === 0 && te.y === 0) {
      return distanceToSegment(point, a, b) <= reach
    }
    const c1 = { x: a.x + ts.x, y: a.y + ts.y }
    const c2 = { x: b.x + te.x, y: b.y + te.y }
    let previous = a
    for (let step = 1; step <= CURVE_SAMPLES; step++) {
      const current = cubicPoint(a, c1, c2, b, step / CURVE_SAMPLES)
      if (distanceToSegment(point, previous, current) <= reach) return true
      previous = current
    }
    return false
  })
}
