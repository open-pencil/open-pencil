import { compact, isEqual } from 'es-toolkit'

import { getAxisAlignedBoundsInParent, getParentWorldMatrix, getWorldMatrix } from '../coordinate'
import { computeBounds } from '../geometry'
import type { SceneGraph } from '../index'
import Matrix from '../matrix'
import type { Vector } from '../primitives'
import type { ConnectorEndpoint, SceneNode, StrokeCap } from '../types'
import { CONNECTOR_LABEL_PADDING, placeConnectorLabel, type ConnectorLabelLayout } from './label'
import { connectorNetwork, piecesBounds, type ConnectorPiece } from './pieces'
import { routeConnector } from './route'
import type { ConnectorRouteEnd } from './sides'
import { connectorSublayers, type ConnectorSublayers } from './sublayers'

/**
 * An end as the router sees it, in the connector's parent's axes: the box of the layer it follows
 * by a magnet, or a point. An end whose layer is gone stays where its route last ended.
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
  if (endpoint.magnet === 'NONE') {
    // A point in the layer's own axes, carried into the connector's parent's.
    const toParent =
      Matrix.invert(getParentWorldMatrix(graph.getNode(parentId), graph)) ?? Matrix.identity()
    const [x, y] = Matrix.mapPoints(Matrix.multiply(toParent, getWorldMatrix(node, graph)), [
      endpoint.position.x,
      endpoint.position.y
    ])
    return { box: null, point: { x, y }, magnet: 'NONE', cap, outline: 0 }
  }
  return {
    box: getAxisAlignedBoundsInParent([node], parentId, graph),
    point: { x: 0, y: 0 },
    magnet: endpoint.magnet,
    cap,
    // FigJam keeps connectors clear of a shape's stroke, centred on its edge; other layers'
    // strokes do not count.
    outline: node.type === 'SHAPE_WITH_TEXT' ? node.strokeWeight / 2 : 0
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

/** Where the connector, its line, and its label go for a route with the label placed on it. */
function routeWrites(
  connector: SceneNode,
  { line, label, labelBackground }: ConnectorSublayers,
  pieces: ConnectorPiece[],
  placed: ConnectorLabelLayout | null,
  labelled: boolean
): Write[] | null {
  const lineBox = pieces.length > 0 ? piecesBounds(pieces) : null
  const boxes = compact([lineBox, labelled ? placed?.plate : null])
  if (boxes.length === 0) return null
  const frame = computeBounds(boxes)
  const lineOrigin = lineBox ?? frame
  const writes: Write[] = [
    [connector, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }],
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

/** Where a connector's line last started or ended, for an end whose layer is gone. */
function lastRoutePoint(connector: SceneNode, line: SceneNode, index: 0 | -1): Vector | undefined {
  const vertex = line.vectorNetwork?.vertices.at(index)
  return vertex && { x: connector.x + line.x + vertex.x, y: connector.y + line.y + vertex.y }
}

/**
 * Routes a connector again from the layers its ends follow and lays out its line, label plate,
 * and label to match, through `update` so the caller decides whether that is an edit or a
 * preview. Returns whether anything moved. A connector with an end that cannot be placed keeps
 * its route.
 */
export function layoutConnector(
  graph: SceneGraph,
  connector: SceneNode,
  update: (id: string, changes: Partial<SceneNode>) => void = (id, changes) =>
    graph.updateNode(id, changes)
): boolean {
  const parts = connectorSublayers(graph, connector)
  const { connectorStart, connectorEnd } = connector
  if (!parts || !connectorStart || !connectorEnd) return false
  const { line, label } = parts
  const start = routeEnd(
    graph,
    connector,
    connectorStart,
    connector.connectorStartCap,
    lastRoutePoint(connector, line, 0)
  )
  const end = routeEnd(
    graph,
    connector,
    connectorEnd,
    connector.connectorEndCap,
    lastRoutePoint(connector, line, -1)
  )
  if (!start || !end) return false
  const weight = line.strokes[0]?.weight ?? line.strokeWeight
  const pieces = routeConnector(connector.connectorLineType, start, end, weight)
  const labelled = label.text !== ''
  const placed = placeConnectorLabel(pieces, {
    width: label.width + CONNECTOR_LABEL_PADDING * 2,
    height: label.height + CONNECTOR_LABEL_PADDING * 2
  })
  const routed = labelled && placed ? placed.pieces : pieces
  const writes = routeWrites(connector, parts, routed, placed, labelled)
  let moved = false
  for (const [node, changes] of writes ?? []) {
    const differing = changesFor(node, changes)
    if (!differing) continue
    update(node.id, differing)
    moved = true
  }
  return moved
}

/** Whether `id` is one of `ids` or lies inside one of them. */
function withinAny(graph: SceneGraph, id: string, ids: ReadonlySet<string>): boolean {
  return graph.closest(id, (node) => ids.has(node.id)) !== undefined
}

/**
 * The connectors with an end on one of `ids` or a layer inside them, which go when those layers
 * are deleted, as in FigJam. Connectors inside `ids` themselves are left out.
 */
export function attachedConnectors(graph: SceneGraph, ids: Iterable<string>): SceneNode[] {
  const roots = new Set(ids)
  const attached: SceneNode[] = []
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'CONNECTOR' || withinAny(graph, node.id, roots)) continue
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
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'CONNECTOR') continue
    const watched = [node.id, node.connectorStart?.nodeId, node.connectorEnd?.nodeId]
    const touched =
      watched.some((id) => id && withinAny(graph, id, ids)) ||
      node.childIds.some((id) => ids.has(id))
    if (touched) affected.push(node)
  }
  return affected
}
