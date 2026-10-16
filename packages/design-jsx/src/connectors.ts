import {
  boundEndpoint,
  CONNECTOR_COLOR,
  CONNECTOR_STROKE_WEIGHT,
  connectorStroke,
  connectorSublayers,
  createConnector,
  freeEndpoint,
  type ConnectorEndpoint,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { colorToHex, tryParseColor } from '@open-pencil/scene-graph/color'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import { CONNECTOR_LINE, CONNECTOR_SIDE, STROKE_CAP } from './enums'
import { isColor } from './overrides/fills'
import type { TreeNode } from './tree'

/**
 * `<Connector from="A" to="B">`: a FigJam connector whose ends name other layers of the same
 * JSX, or give `{ x, y }` points in its parent. Ends resolve once the whole tree is rendered, and
 * the connector routes once it is laid out.
 */
export const CONNECTOR_ELEMENT = 'connector'

function isPoint(value: unknown): value is Vector {
  if (typeof value !== 'object' || value === null || !('x' in value) || !('y' in value)) {
    return false
  }
  return typeof value.x === 'number' && typeof value.y === 'number'
}

function labelOf(tree: TreeNode): string {
  return tree.children.filter((child): child is string => typeof child === 'string').join('')
}

/** Makes the connector an element describes, its ends free until `resolveConnectorEnds`. */
export function renderConnectorNode(graph: SceneGraph, tree: TreeNode, parentId: string) {
  const { props } = tree
  const line = CONNECTOR_LINE.parse(props.line)
  const parent = graph.getNode(parentId)
  const connector = createConnector(
    graph,
    parentId,
    {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(0, 0),
      lineType: line,
      startCap: STROKE_CAP.parse(props.startCap) ?? 'NONE',
      endCap: STROKE_CAP.parse(props.endCap) ?? 'ARROW_LINES',
      text: labelOf(tree)
    },
    {
      ...(typeof props.name === 'string' && { name: props.name }),
      ...(props.visible === false && { visible: false }),
      ...(typeof props.opacity === 'number' && { opacity: props.opacity }),
      // A connector is drawn between layers, not placed by its parent's auto layout.
      ...(parent && parent.layoutMode !== 'NONE' && { layoutPositioning: 'ABSOLUTE' as const })
    }
  )
  const lineLayer = connectorSublayers(graph, connector)?.line
  if (lineLayer) styleLine(graph, lineLayer, props)
  return connector
}

function colorOf(value: unknown): Color | undefined {
  if (isColor(value)) return value
  return typeof value === 'string' ? (tryParseColor(value) ?? undefined) : undefined
}

/** Restyles the line by `stroke`, `strokeWidth`, and `dashPattern`; each left out keeps FigJam's. */
function styleLine(graph: SceneGraph, line: SceneNode, props: TreeNode['props']) {
  const [stroke = connectorStroke()] = line.strokes
  const color = colorOf(props.stroke) ?? stroke.color
  const weight =
    typeof props.strokeWidth === 'number' && props.strokeWidth > 0
      ? props.strokeWidth
      : stroke.weight
  const dashPattern = Array.isArray(props.dashPattern)
    ? props.dashPattern.filter((length): length is number => typeof length === 'number')
    : line.dashPattern
  graph.updateNode(line.id, {
    strokes: [{ ...stroke, color, weight }],
    strokeWeight: weight,
    dashPattern
  })
}

function endpointOf(
  value: unknown,
  side: unknown,
  straight: boolean,
  named: ReadonlyMap<string, string>
): ConnectorEndpoint | null {
  if (isPoint(value)) return freeEndpoint(value.x, value.y)
  if (typeof value !== 'string') return null
  const id = named.get(value)
  if (!id) return null
  return boundEndpoint(id, straight ? 'CENTER' : (CONNECTOR_SIDE.parse(side) ?? 'AUTO'))
}

/**
 * Binds the ends of connectors rendered from `trees` to the layers they name among `rootIds`'
 * layers, the first of a name winning. Returns warnings for ends that name no layer.
 */
export function resolveConnectorEnds(
  graph: SceneGraph,
  rootIds: readonly string[],
  connectors: ReadonlyArray<{ node: SceneNode; tree: TreeNode }>
): string[] {
  if (connectors.length === 0) return []
  const named = new Map<string, string>()
  for (const rootId of rootIds) {
    for (const { node } of graph.flattenTree(rootId)) {
      if (node.type !== 'CONNECTOR' && !named.has(node.name)) named.set(node.name, node.id)
    }
  }
  const warnings: string[] = []
  for (const { node, tree } of connectors) {
    const straight = node.connectorLineType === 'STRAIGHT'
    const start = endpointOf(tree.props.from, tree.props.fromSide, straight, named)
    const end = endpointOf(tree.props.to, tree.props.toSide, straight, named)
    if (!start) warnings.push(`<Connector> from="${String(tree.props.from)}" names no layer.`)
    if (!end) warnings.push(`<Connector> to="${String(tree.props.to)}" names no layer.`)
    graph.updateNode(node.id, {
      ...(start && { connectorStart: start }),
      ...(end && { connectorEnd: end })
    })
  }
  return warnings
}

/** A connector's props as `<Connector>` writes them, its ends by the names of their layers. */
export function connectorProps(graph: SceneGraph, node: SceneNode): Array<[string, unknown]> {
  const end = (endpoint: ConnectorEndpoint | null) => {
    if (!endpoint) return null
    const layer = endpoint.nodeId ? graph.getNode(endpoint.nodeId) : undefined
    return layer ? layer.name : { x: endpoint.position.x, y: endpoint.position.y }
  }
  const side = (endpoint: ConnectorEndpoint | null) => {
    if (!endpoint?.nodeId) return undefined
    const magnet = endpoint.magnet
    if (magnet !== 'TOP' && magnet !== 'RIGHT' && magnet !== 'BOTTOM' && magnet !== 'LEFT') {
      return undefined
    }
    return CONNECTOR_SIDE.print(magnet)
  }
  const props: Array<[string, unknown]> = [
    ['from', end(node.connectorStart)],
    ['to', end(node.connectorEnd)],
    ['fromSide', side(node.connectorStart)],
    ['toSide', side(node.connectorEnd)],
    [
      'line',
      node.connectorLineType === 'ELBOWED'
        ? undefined
        : CONNECTOR_LINE.print(node.connectorLineType)
    ],
    [
      'startCap',
      node.connectorStartCap === 'NONE' ? undefined : STROKE_CAP.print(node.connectorStartCap)
    ],
    [
      'endCap',
      node.connectorEndCap === 'ARROW_LINES' ? undefined : STROKE_CAP.print(node.connectorEndCap)
    ]
  ]
  const line = connectorSublayers(graph, node)?.line
  const stroke = line?.strokes[0]
  if (stroke && colorToHex(stroke.color) !== colorToHex(CONNECTOR_COLOR)) {
    props.push(['stroke', colorToHex(stroke.color)])
  }
  if (stroke && stroke.weight !== CONNECTOR_STROKE_WEIGHT)
    props.push(['strokeWidth', stroke.weight])
  if (line && line.dashPattern.length > 0) props.push(['dashPattern', [...line.dashPattern]])
  return props.filter(([, value]) => value !== undefined && value !== null)
}

/** The label a connector writes as its children. */
export function connectorLabel(graph: SceneGraph, node: SceneNode): string {
  return connectorSublayers(graph, node)?.label.text ?? ''
}
