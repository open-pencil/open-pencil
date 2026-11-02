import { compact, isEqual, pick } from 'es-toolkit'

import { getAxisAlignedBoundsInParent, getParentWorldMatrix, getWorldMatrix } from '../coordinate'
import { computeBounds } from '../geometry'
import type { SceneGraph } from '../graph'
import Matrix from '../matrix'
import type { Vector } from '../primitives'
import type { ConnectorControlPoint, ConnectorEndpoint, SceneNode, StrokeCap } from '../types'
import { elbowControlPoints } from './controls'
import { CONNECTOR_LABEL_PADDING, placeConnectorLabel, type ConnectorLabelLayout } from './label'
import { connectorNetwork, piecesBounds, type ConnectorPiece } from './pieces'
import { routeConnector, type ConnectorRouteControls } from './route'
import { connectorSides, type ConnectorRouteEnd, type ConnectorSide } from './sides'
import { connectorRouteEnds, connectorSublayers, type ConnectorSublayers } from './sublayers'

/**
 * An end as the router sees it, in the connector's parent's axes: the box of the layer it follows
 * by a magnet, or a point, which an end pinned to a point of its layer follows as the layer moves.
 * An end whose layer is gone stays where its route last ended.
 */
function routeEnd(
  graph: SceneGraph,
  connector: SceneNode,
  endpoint: ConnectorEndpoint,
  cap: StrokeCap,
  fallback: Vector | undefined
): ConnectorRouteEnd | null {
  const parentId = connector.parentId
  if (!parentId) return null
  const node = endpoint.nodeId ? graph.getNode(endpoint.nodeId) : undefined
  if (!node) {
    if (endpoint.nodeId && !fallback) return null
    const point = endpoint.nodeId && fallback ? fallback : endpoint.position
    return { box: null, point, magnet: 'NONE', cap, outline: 0 }
  }
  // An elbow or curve joined at the centre runs into the layer to its centre, as Figma Design
  // draws it; a straight line stops at the outline on its way there.
  const centred = endpoint.magnet === 'CENTER' && connector.connectorLineType !== 'STRAIGHT'
  if (endpoint.magnet === 'NONE' || endpoint.magnet === 'ABSOLUTE' || centred) {
    // A point in the layer's own axes, carried into the connector's parent's.
    const toParent =
      Matrix.invert(getParentWorldMatrix(graph.getNode(parentId), graph)) ?? Matrix.identity()
    const local = centred ? { x: node.width / 2, y: node.height / 2 } : endpoint.position
    const [x, y] = Matrix.mapPoints(Matrix.multiply(toParent, getWorldMatrix(node, graph)), [
      local.x,
      local.y
    ])
    return { box: null, point: { x, y }, magnet: endpoint.magnet, cap, outline: 0 }
  }
  return {
    box: getAxisAlignedBoundsInParent([node], parentId, graph),
    point: { x: 0, y: 0 },
    magnet: endpoint.magnet,
    cap,
    // FigJam keeps connectors clear of a shape's stroke, centred on its edge, hidden or not; a
    // shape with no stroke, or another layer's stroke, does not count.
    outline: node.type === 'SHAPE_WITH_TEXT' && node.strokes.length > 0 ? node.strokeWeight / 2 : 0
  }
}

/** Writes only the fields that differ, so a route that did not move changes nothing. */
function changesFor(node: SceneNode, changes: Partial<SceneNode>): Partial<SceneNode> | null {
  const differing = Object.fromEntries(
    Object.entries(changes).filter(([key, value]) => !isEqual(node[key as keyof SceneNode], value))
  ) as Partial<SceneNode>
  return Object.keys(differing).length > 0 ? differing : null
}

type Write = [SceneNode, Partial<SceneNode>]

function shifted(point: Vector, by: Vector): Vector {
  return { x: point.x + by.x, y: point.y + by.y }
}

/** Control points carried between the connector's own axes and its parent's, by `by`. */
function shiftControls(
  points: ConnectorControlPoint[],
  curve: [Vector, Vector] | null,
  by: Vector
): ConnectorRouteControls {
  return {
    points: points.map((point) => ({ ...point, position: shifted(point.position, by) })),
    curve: curve && [shifted(curve[0], by), shifted(curve[1], by)]
  }
}

/** A connector's route as its ends and control points give it, in its parent's axes. */
export interface ConnectorRoute {
  start: ConnectorRouteEnd
  end: ConnectorRouteEnd
  sides: [ConnectorSide, ConnectorSide]
  /** The line before its label cuts it. */
  pieces: ConnectorPiece[]
  /** Its control points in its parent's axes. */
  controls: ConnectorRouteControls
}

/**
 * Routes a connector from the layers its ends follow and the control points it was dragged to,
 * without laying anything out. Null when an end cannot be placed.
 */
export function connectorRoute(graph: SceneGraph, connector: SceneNode): ConnectorRoute | null {
  const parts = connectorSublayers(graph, connector)
  const { connectorStart, connectorEnd } = connector
  if (!parts || !connectorStart || !connectorEnd) return null
  // Where the line last ran, for an end whose layer is gone.
  const drawn = connectorRouteEnds(graph, connector)
  const start = routeEnd(
    graph,
    connector,
    connectorStart,
    connector.connectorStartCap,
    drawn?.start
  )
  const end = routeEnd(graph, connector, connectorEnd, connector.connectorEndCap, drawn?.end)
  if (!start || !end) return null
  const weight = parts.line.strokes[0]?.weight ?? parts.line.strokeWeight
  const controls = shiftControls(
    connector.connectorControlPoints,
    connector.connectorCurveHandles,
    connector
  )
  return {
    start,
    end,
    sides: connectorSides(start, end),
    pieces: routeConnector(connector.connectorLineType, start, end, weight, controls),
    controls
  }
}

/**
 * Where the connector, its line, and its label go for a route with the label placed on it. A
 * connector that keeps its box places its line and label inside the box it has.
 */
function routeWrites(
  connector: SceneNode,
  { line, label, labelBackground }: ConnectorSublayers,
  pieces: ConnectorPiece[],
  placed: ConnectorLabelLayout | null,
  labelled: boolean,
  keepBox: boolean,
  controls: ConnectorRouteControls
): Write[] | null {
  const lineBox = pieces.length > 0 ? piecesBounds(pieces) : null
  const boxes = compact([lineBox, labelled ? placed?.plate : null])
  if (boxes.length === 0) return null
  const bounds = computeBounds(boxes)
  const frame = keepBox ? connector : bounds
  const lineOrigin = lineBox ?? bounds
  // Control points stay where they are in the parent as the connector's box moves to fit.
  const local = shiftControls(controls.points, controls.curve, { x: -frame.x, y: -frame.y })
  const writes: Write[] = [
    [
      connector,
      {
        ...(keepBox ? {} : pick(frame, ['x', 'y', 'width', 'height'])),
        connectorControlPoints: local.points,
        connectorCurveHandles: local.curve
      }
    ],
    [
      line,
      {
        x: lineOrigin.x - frame.x,
        y: lineOrigin.y - frame.y,
        width: lineOrigin.width,
        height: lineOrigin.height,
        vectorNetwork: connectorNetwork(pieces, lineOrigin, {
          start: connector.connectorStartCap,
          end: connector.connectorEndCap
        })
      }
    ]
  ]
  if (!placed) return [...writes, [labelBackground, { visible: false }]]
  const x = placed.plate.x - frame.x
  const y = placed.plate.y - frame.y
  const { width, height } = placed.plate
  // An empty label still sits where its text goes, ready to be typed into.
  return [
    ...writes,
    [labelBackground, { x, y, width, height, visible: labelled }],
    [label, { x: x + CONNECTOR_LABEL_PADDING, y: y + CONNECTOR_LABEL_PADDING, visible: true }]
  ]
}

/**
 * Routes a connector again from the layers its ends follow and lays out its line, label plate,
 * and label to match, through `update` so the caller decides whether that is an edit or a
 * preview. Returns whether anything moved. A connector with an end that cannot be placed keeps
 * its route. With `keepBox`, the connector keeps its own position and size, as while a move
 * previews. With `capture`, an elbow that was dragged keeps its new route's segments as its
 * control points, as FigJam does after an edit reroutes one.
 */
export function layoutConnector(
  graph: SceneGraph,
  connector: SceneNode,
  update: (id: string, changes: Partial<SceneNode>) => void = (id, changes) =>
    graph.updateNode(id, changes),
  { keepBox = false, capture = false }: { keepBox?: boolean; capture?: boolean } = {}
): boolean {
  const parts = connectorSublayers(graph, connector)
  const route = connectorRoute(graph, connector)
  if (!parts || !route) return false
  const { label } = parts
  const { pieces } = route
  const controls =
    capture && connector.connectorLineType === 'ELBOWED' && route.controls.points.length > 0
      ? { ...route.controls, points: elbowControlPoints(pieces) }
      : route.controls
  const labelled = label.text !== ''
  const placed = placeConnectorLabel(
    pieces,
    {
      width: label.width + CONNECTOR_LABEL_PADDING * 2,
      height: label.height + CONNECTOR_LABEL_PADDING * 2
    },
    connector.connectorLabelPosition
  )
  const routed = labelled && placed ? placed.pieces : pieces
  const writes = routeWrites(connector, parts, routed, placed, labelled, keepBox, controls)
  let moved = false
  // A route derives from its ends, so laying it out is layout rather than an edit, as moving the
  // connector it fits is not.
  graph.withLayoutMutations(() => {
    for (const [node, changes] of writes ?? []) {
      const differing = changesFor(node, changes)
      if (!differing) continue
      update(node.id, differing)
      moved = true
    }
  })
  return moved
}

/** Whether `id` is one of `ids` or lies inside one of them. */
function withinAny(graph: SceneGraph, id: string, ids: ReadonlySet<string>): boolean {
  return graph.closest(id, (node) => ids.has(node.id)) !== undefined
}

/** The graph's connectors, from its index rather than a scan of every layer. */
function* connectorsIn(graph: SceneGraph): Generator<SceneNode> {
  for (const id of graph.connectorIds) {
    const node = graph.getNode(id)
    if (node?.type === 'CONNECTOR') yield node
  }
}

/**
 * The connectors with an end on one of `ids` or a layer inside them, which go when those layers
 * are deleted, as in FigJam. Connectors inside `ids` themselves are left out.
 */
export function attachedConnectors(graph: SceneGraph, ids: Iterable<string>): SceneNode[] {
  const roots = new Set(ids)
  const attached: SceneNode[] = []
  for (const node of connectorsIn(graph)) {
    if (withinAny(graph, node.id, roots)) continue
    const ends = [node.connectorStart?.nodeId, node.connectorEnd?.nodeId]
    if (ends.some((id) => id && withinAny(graph, id, roots))) attached.push(node)
  }
  return attached
}

/**
 * The connectors an edit to `ids` moves: those with an end on one of them or on a layer inside
 * them, those inside them, and those whose line or label is among them.
 */
export function connectorsAffectedBy(graph: SceneGraph, ids: ReadonlySet<string>): SceneNode[] {
  if (ids.size === 0) return []
  const affected: SceneNode[] = []
  for (const node of connectorsIn(graph)) {
    const watched = [node.id, node.connectorStart?.nodeId, node.connectorEnd?.nodeId]
    const touched =
      watched.some((id) => id && withinAny(graph, id, ids)) ||
      node.childIds.some((id) => ids.has(id))
    if (touched) affected.push(node)
  }
  return affected
}
