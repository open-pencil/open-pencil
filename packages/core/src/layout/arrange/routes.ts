import type { ConnectorControlPoint, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  connectorRoute,
  connectorSublayers,
  CONNECTOR_LABEL_PADDING,
  curveControlPoints,
  curveMidpoint,
  dragCurve,
  elbowControlPoints,
  layoutConnector,
  type ConnectorPiece
} from '@open-pencil/scene-graph/connectors'
import type { Size, Vector } from '@open-pencil/scene-graph/primitives'

/**
 * The control lines an elbow takes to run through bend points in turn: across to each point,
 * then along to it, starting square to the side the connector leaves by.
 */
function elbowThrough(points: Vector[], leavesAcross: boolean): ConnectorControlPoint[] {
  const controls: ConnectorControlPoint[] = []
  for (const point of points) {
    const vertical: ConnectorControlPoint = { position: { ...point }, direction: 'VERTICAL' }
    const horizontal: ConnectorControlPoint = { position: { ...point }, direction: 'HORIZONTAL' }
    // A connector leaving sideways runs across to the point first.
    const pair = leavesAcross ? [vertical, horizontal] : [horizontal, vertical]
    for (const control of pair) {
      const last = controls.at(-1)
      if (last?.direction === control.direction) {
        last.position = control.position
        continue
      }
      controls.push(control)
    }
  }
  return controls
}

/** Points in the connector's parent's axes as points in its own. */
function local(node: SceneNode, point: Vector): Vector {
  return { x: point.x - node.x, y: point.y - node.y }
}

function relayout(graph: SceneGraph, connectorId: string): void {
  const node = graph.getNode(connectorId)
  if (node) layoutConnector(graph, node)
}

/**
 * Bends an elbow or a curve through bend points, in the connector's parent's axes, as a drawing
 * tool's edge passes through the points it stores: an elbow runs through each in turn, a curve's
 * middle passes the middle one.
 */
export function bendConnectorThrough(
  graph: SceneGraph,
  connector: SceneNode,
  points: Vector[]
): void {
  if (points.length === 0) return
  const node = graph.getNode(connector.id)
  const route = node ? connectorRoute(graph, node) : null
  if (!node || !route) return
  if (node.connectorLineType === 'CURVED') {
    const curve = route.pieces.at(0)
    if (!curve) return
    const through = points[Math.floor(points.length / 2)]
    const middle = curveMidpoint(curve)
    const [first, second] = dragCurve(curveControlPoints(curve), {
      x: through.x - middle.x,
      y: through.y - middle.y
    })
    graph.updateNode(node.id, { connectorCurveHandles: [local(node, first), local(node, second)] })
  } else {
    const across = route.sides[0] === 'LEFT' || route.sides[0] === 'RIGHT'
    graph.updateNode(node.id, {
      connectorControlPoints: elbowThrough(points, across).map((control) => ({
        ...control,
        position: local(node, control.position)
      }))
    })
  }
  relayout(graph, node.id)
}

/**
 * Runs an elbow along a right-angled route, in the connector's parent's axes, from its start to
 * its end: each segment between the first and the last becomes a dragged segment, as FigJam
 * records an elbow that was edited into that shape.
 */
export function runConnectorAlong(graph: SceneGraph, connectorId: string, route: Vector[]): void {
  relayout(graph, connectorId)
  const node = graph.getNode(connectorId)
  if (!node) return
  const pieces: ConnectorPiece[] = route.slice(1).map((to, index) => ({
    from: route[index] ?? to,
    to,
    handleFrom: { x: 0, y: 0 },
    handleTo: { x: 0, y: 0 }
  }))
  graph.updateNode(connectorId, {
    connectorControlPoints: elbowControlPoints(pieces).map((control) => ({
      ...control,
      position: local(node, control.position)
    }))
  })
  relayout(graph, connectorId)
}

/** The room a connector's label takes along its line, or null for a connector without one. */
export function connectorLabelSize(graph: SceneGraph, connectorId: string): Size | null {
  const connector = graph.getNode(connectorId)
  const label = connector ? connectorSublayers(graph, connector)?.label : undefined
  if (!label?.text) return null
  return {
    width: label.width + 2 * CONNECTOR_LABEL_PADDING,
    height: label.height + 2 * CONNECTOR_LABEL_PADDING
  }
}
