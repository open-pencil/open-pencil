import { BLACK } from '../constants'
import type { GeneratedFrameKind } from '../generated/kind'
import type { SceneGraph } from '../graph'
import type { Color, Vector } from '../primitives'
import { pixelLength } from '../text/lengths'
import type { ConnectorEndpoint, Fill, SceneNode, Stroke, VectorNetwork } from '../types'

/**
 * A FigJam connector as Figma draws it by default: a grey line 4 px wide with rounded elbows, a
 * round start, and an arrow at the end. Measured in FigJam.
 */
export const CONNECTOR_COLOR: Color = { r: 117 / 255, g: 117 / 255, b: 117 / 255, a: 1 }
export const CONNECTOR_STROKE_WEIGHT = 4
/** FigJam's line menu draws a connector Thin, at its default weight, or Thick, at twice it. */
export const CONNECTOR_THICK_STROKE_WEIGHT = 8
export const CONNECTOR_CORNER_RADIUS = 24
/** The face a connector's label starts in, as FigJam's: Inter Medium. */
export const CONNECTOR_LABEL_FONT = { family: 'Inter', weight: 500 } as const

/** The dash FigJam's line menu draws a connector with, longer for a thick line. Measured in FigJam. */
export function connectorDash(weight: number): number[] {
  return weight >= CONNECTOR_THICK_STROKE_WEIGHT ? [40, 24] : [16, 10]
}

/** How a connector's line is drawn: its colour, weight, and whether it is dashed. */
export interface ConnectorLineStyle {
  color: Color
  weight: number
  dashed: boolean
}

/** The style a connector's line is drawn in. */
export function connectorLineStyle(line: Pick<SceneNode, 'strokes'>): ConnectorLineStyle {
  const stroke = line.strokes.at(0) ?? connectorStroke()
  return {
    color: { ...stroke.color },
    weight: stroke.weight,
    dashed: (stroke.dashPattern?.length ?? 0) > 0
  }
}

/**
 * A connector's line restyled by `style`, each part left out kept, as FigJam's colour and line
 * menus set it. A new weight or dash takes FigJam's dash for the weight, while a new colour alone
 * keeps the dash the line has, even one of its own. The dash goes on the stroke, which draws with
 * it, and on the line, which files keep.
 */
export function connectorLineStyleFields(
  line: Pick<SceneNode, 'strokes'>,
  style: Partial<ConnectorLineStyle>
): Partial<SceneNode> {
  const current = connectorLineStyle(line)
  const color = style.color ?? current.color
  const weight = style.weight ?? current.weight
  const dashed = style.dashed ?? current.dashed
  const [stroke = connectorStroke()] = line.strokes
  const restyled = style.weight !== undefined || style.dashed !== undefined
  const kept = stroke.dashPattern?.length ? [...stroke.dashPattern] : connectorDash(weight)
  const dashPattern = dashed ? (restyled ? connectorDash(weight) : kept) : []
  return {
    strokes: [{ ...stroke, color: { ...color }, weight, dashPattern: [...dashPattern] }],
    strokeWeight: weight,
    dashPattern
  }
}

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

/**
 * FigJam keeps a connector's box to its route, so it never turns or resizes on its own; typing
 * into it edits its label.
 */
export const CONNECTOR_KIND: GeneratedFrameKind = {
  complete: (graph, frame) => connectorSublayers(graph, frame) !== null,
  text: (graph, frame) => connectorSublayers(graph, frame)?.label,
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
    fontFamily: CONNECTOR_LABEL_FONT.family,
    fontWeight: CONNECTOR_LABEL_FONT.weight,
    fontSize: 16,
    lineHeight: pixelLength(24),
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
  const ends = connectorLineEnds(graph, connector)
  if (!ends) return null
  const at = (vertex: Vector) => ({
    x: connector.x + ends.line.x + vertex.x,
    y: connector.y + ends.line.y + vertex.y
  })
  return { start: at(ends.start), end: at(ends.end) }
}

/** A connector's line and where it starts and ends, in the line's own axes. */
export function connectorLineEnds(
  graph: SceneGraph,
  connector: SceneNode
): { line: SceneNode; start: Vector; end: Vector } | null {
  const line = connectorSublayers(graph, connector)?.line
  const vertices = line?.vectorNetwork?.vertices ?? []
  const start = vertices.at(0)
  const end = vertices.at(-1)
  return line && start && end ? { line, start, end } : null
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

/** The connector whose label `node` is, if it is one. */
export function labelledConnector(graph: SceneGraph, node: SceneNode): SceneNode | null {
  if (node.type !== 'TEXT' || !node.parentId) return null
  const owner = graph.getNode(node.parentId)
  if (owner?.type !== 'CONNECTOR') return null
  return connectorSublayers(graph, owner)?.label.id === node.id ? owner : null
}
