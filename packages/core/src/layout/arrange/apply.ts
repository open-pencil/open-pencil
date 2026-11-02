import type { SceneGraph } from '@open-pencil/scene-graph'
import { boundEndpoint, layoutConnector } from '@open-pencil/scene-graph/connectors'
import { getParentWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import type { ArrangeInput, ArrangedRoute, Arrangement } from './boxes'
import { runConnectorAlong } from './routes'

/** The layers that draw an arrangement's boxes and edges, by their ids. */
export interface ArrangedLayers {
  /** The layer drawing each box and group. */
  boxes: Map<string, string>
  /** The connector drawing each edge; an edge drawn by none only shapes the arrangement. */
  connectors: Map<string, string>
}

/** Where an arrangement goes in its parent: by its top-left corner or by its centre. */
export type ArrangePlacement = { topLeft: Vector } | { center: Vector }

function bounds(boxes: Rect[]): Rect {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return {
    x,
    y,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - y
  }
}

/**
 * Joins a connector to the layers at its edge's ends by the sides the route takes: an elbow runs
 * along the route, which `place` carries into the connector's parent's axes, a curve bends between those sides,
 * and a straight line keeps its ends.
 */
function joinConnector(
  graph: SceneGraph,
  connectorId: string,
  [start, end]: [string, string],
  route: ArrangedRoute | undefined,
  place: (point: Vector) => Vector
): void {
  const connector = graph.getNode(connectorId)
  if (!connector) return
  if (connector.connectorLineType === 'STRAIGHT') {
    layoutConnector(graph, connector)
    return
  }
  graph.updateNode(connectorId, {
    connectorStart: boundEndpoint(start, route?.startSide ?? 'AUTO'),
    connectorEnd: boundEndpoint(end, route?.endSide ?? 'AUTO'),
    connectorCurveHandles: null,
    connectorControlPoints: []
  })
  if (connector.connectorLineType === 'CURVED') {
    const curve = graph.getNode(connectorId)
    if (curve) layoutConnector(graph, curve)
    return
  }
  runConnectorAlong(graph, connectorId, (route?.points ?? []).map(place))
}

/**
 * Puts the layers that draw an arrangement where it placed them, the whole at `placement` in its
 * parent: each box's layer at its box and each group's at its box and size, in the axes of the group
 * holding it, if any. Each edge's connector is joined to the layers at its ends by the sides the
 * arrangement chose: an elbow runs along the route a flow gave, a curve bends between those sides, and a
 * straight line keeps its ends.
 */
export function applyArrangement(
  graph: SceneGraph,
  input: ArrangeInput,
  arrangement: Arrangement,
  layers: ArrangedLayers,
  placement: ArrangePlacement
): void {
  const boxes = new Map<string, Rect>([...arrangement.groups, ...arrangement.boxes])
  if (boxes.size === 0) return
  const drawing = bounds([...boxes.values()])
  const origin =
    'center' in placement
      ? {
          x: placement.center.x - drawing.width / 2,
          y: placement.center.y - drawing.height / 2
        }
      : placement.topLeft
  const shift = { x: origin.x - drawing.x, y: origin.y - drawing.y }
  const groupOf = new Map(
    [...input.boxes, ...input.groups].map((member) => [member.id, member.group])
  )
  // The layer the arrangement's top-level layers share.
  const topLayer = [...layers.boxes].find(([id]) => groupOf.get(id) === undefined)?.[1]
  const parentId = topLayer ? graph.getNode(topLayer)?.parentId : null
  const parent = parentId ? graph.getNode(parentId) : undefined
  for (const [id, layerId] of layers.boxes) {
    const box = boxes.get(id)
    if (!box) continue
    const group = groupOf.get(id)
    const outer = group ? boxes.get(group) : undefined
    const position = outer
      ? { x: box.x - outer.x, y: box.y - outer.y }
      : { x: box.x + shift.x, y: box.y + shift.y }
    // A group's layer takes the size the arrangement gave it; a box's keeps its own.
    if (arrangement.groups.has(id)) {
      graph.updateNode(layerId, { ...position, width: box.width, height: box.height })
    } else {
      graph.updateNode(layerId, position)
    }
  }
  for (const edge of input.edges) {
    const connectorId = layers.connectors.get(edge.id)
    const start = layers.boxes.get(edge.from)
    const end = layers.boxes.get(edge.to)
    if (!connectorId || !start || !end) continue
    // The route is in the arrangement's parent's axes; the connector may live in another layer.
    const connector = graph.getNode(connectorId)
    const into = Matrix.multiply(
      Matrix.invert(getParentWorldMatrix(graph.getNode(connector?.parentId ?? ''), graph)) ??
        Matrix.identity(),
      getParentWorldMatrix(parent, graph)
    )
    const place = (point: Vector) =>
      Matrix.mapPoint(into, { x: point.x + shift.x, y: point.y + shift.y })
    joinConnector(graph, connectorId, [start, end], arrangement.edges.get(edge.id), place)
  }
}
