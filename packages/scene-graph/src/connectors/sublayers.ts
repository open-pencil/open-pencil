import { BLACK } from '../constants'
import type { GeneratedFrameKind } from '../generated/kind'
import type { SceneGraph } from '../index'
import type { Color, Vector } from '../primitives'
import type { ConnectorEndpoint, Fill, SceneNode, Stroke, VectorNetwork } from '../types'

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
