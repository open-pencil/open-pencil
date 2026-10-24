import type { DrawioCell, DrawioStyle } from '@open-pencil/drawio'
import type {
  ConnectorControlPoint,
  ConnectorEndpoint,
  ConnectorLabelPosition,
  ConnectorLineType,
  ConnectorMagnet,
  SceneGraph,
  SceneNode,
  StrokeCap
} from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  connectorRoute,
  connectorSublayers,
  createConnector,
  curveControlPoints,
  curveMidpoint,
  dragCurve,
  freeEndpoint,
  layoutConnector
} from '@open-pencil/scene-graph/connectors'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { readLabel } from './label'
import { dashOf, labelFields, labelFormat, lineColor } from './paint'

/** Edge styles that route at right angles, as FigJam's elbowed connectors do. */
const ELBOW_STYLES = new Set([
  'orthogonalEdgeStyle',
  'elbowEdgeStyle',
  'entityRelationEdgeStyle',
  'segmentEdgeStyle',
  'isometricEdgeStyle'
])

/**
 * The line type an edge draws: curved when `curved=1`, elbowed for a right-angled edge style or
 * an edge bent through points of its own, and straight otherwise.
 */
function lineTypeOf(edge: DrawioCell): ConnectorLineType {
  const { values } = edge.style
  if (values.curved === '1') return 'CURVED'
  if (ELBOW_STYLES.has(values.edgeStyle ?? '') || edge.geometry.points.length > 0) return 'ELBOWED'
  return 'STRAIGHT'
}

/**
 * draw.io arrowheads and the FigJam ends that draw them: a filled triangle is FigJam's triangle
 * arrow (its "triangle" end points back, as a reversed one), an open one its line arrow.
 */
const CAPS: Record<string, StrokeCap> = {
  none: 'NONE',
  classic: 'ARROW_EQUILATERAL',
  classicThin: 'ARROW_EQUILATERAL',
  block: 'ARROW_EQUILATERAL',
  blockThin: 'ARROW_EQUILATERAL',
  open: 'ARROW_LINES',
  openThin: 'ARROW_LINES',
  openAsync: 'ARROW_LINES',
  async: 'ARROW_LINES',
  oval: 'CIRCLE_FILLED',
  diamond: 'DIAMOND_FILLED',
  diamondThin: 'DIAMOND_FILLED'
}

/** An end's cap: `startArrow` is none and `endArrow` classic unless the style says otherwise. */
function capOf(style: DrawioStyle, key: 'startArrow' | 'endArrow'): StrokeCap {
  const arrow = style.values[key] ?? (key === 'endArrow' ? 'classic' : 'none')
  const fill = style.values[key === 'endArrow' ? 'endFill' : 'startFill']
  const cap = CAPS[arrow] ?? 'ARROW_LINES'
  // An unfilled triangle draws as FigJam's open arrow.
  return fill === '0' && cap === 'ARROW_EQUILATERAL' ? 'ARROW_LINES' : cap
}

/**
 * Where a label sits along an edge: draw.io keeps it `x` of the way from -1 at the source to 1 at
 * the target, or in the middle.
 */
export function labelPositionOf(x: number): ConnectorLabelPosition | null {
  if (x === 0) return null
  return {
    section: x < 0 ? 'MIDDLE_TO_START' : 'MIDDLE_TO_END',
    offset: Math.min(1, Math.abs(x)),
    offAxis: 'NONE'
  }
}

/** A drawn edge, made before the layers its ends join, so it keeps its place in the order. */
export interface PendingEdge {
  connector: SceneNode
  edge: DrawioCell
  /** Labels draw.io keeps as cells of the edge, which the connector's label takes in turn. */
  labels: DrawioCell[]
}

/**
 * Makes the connector an edge draws, in `parentId`, its ends free until `bindEdge` joins them.
 * Its line takes the edge's colour, width and dash.
 */
export function createEdge(
  graph: SceneGraph,
  parentId: string,
  edge: DrawioCell,
  labels: DrawioCell[]
): PendingEdge {
  const { style } = edge
  const connector = createConnector(
    graph,
    parentId,
    {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(0, 0),
      lineType: lineTypeOf(edge),
      startCap: capOf(style, 'startArrow'),
      endCap: capOf(style, 'endArrow')
    },
    { visible: edge.visible }
  )
  const line = connectorSublayers(graph, connector)?.line
  const color = lineColor(style)
  const stroke = line?.strokes.at(0)
  if (line && stroke) {
    const weight = Number.parseFloat(style.values.strokeWidth ?? '1') || 1
    const dashPattern = dashOf(style, weight)
    graph.updateNode(line.id, {
      strokes: color ? [{ ...stroke, color: { ...color }, weight, dashPattern }] : [],
      strokeWeight: weight,
      dashPattern
    })
  }
  return { connector, edge, labels }
}

/**
 * An end of an edge: bound to the layer `cellId` drew, where `exitX`/`exitY` (or `entryX`/
 * `entryY`) put it as shares of the layer's box, or by the side it picks; free at the point the
 * edge stores when it joins nothing.
 */
/**
 * The side of `box` that faces `toward`, as an edge bent through a point leaves or enters by the
 * side that point lies beyond; null for a point over the box.
 */
function sideFacing(
  box: Pick<SceneNode, 'x' | 'y' | 'width' | 'height'>,
  toward: Vector
): ConnectorMagnet | null {
  if (toward.x > box.x + box.width) return 'RIGHT'
  if (toward.x < box.x) return 'LEFT'
  if (toward.y < box.y) return 'TOP'
  if (toward.y > box.y + box.height) return 'BOTTOM'
  return null
}

function endpointOf(
  graph: SceneGraph,
  layerOf: (cellId: string) => string | undefined,
  edge: DrawioCell,
  end: 'source' | 'target',
  straight: boolean
): ConnectorEndpoint {
  const cellId = edge[end]
  const nodeId = cellId ? layerOf(cellId) : undefined
  const node = nodeId ? graph.getNode(nodeId) : undefined
  if (node) {
    const prefix = end === 'source' ? 'exit' : 'entry'
    const x = Number.parseFloat(edge.style.values[`${prefix}X`] ?? '')
    const y = Number.parseFloat(edge.style.values[`${prefix}Y`] ?? '')
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return {
        nodeId: node.id,
        magnet: 'NONE',
        position: { x: x * node.width, y: y * node.height }
      }
    }
    const { points } = edge.geometry
    const toward = end === 'source' ? points.at(0) : points.at(-1)
    // Both share the edge's parent's axes when the layer is a sibling of the edge.
    const facing =
      toward && node.parentId === layerOf(edge.parent) ? sideFacing(node, toward) : null
    return boundEndpoint(node.id, straight ? 'CENTER' : (facing ?? 'AUTO'))
  }
  const point = end === 'source' ? edge.geometry.sourcePoint : edge.geometry.targetPoint
  return freeEndpoint(point?.x ?? 0, point?.y ?? 0)
}

/**
 * The control lines an elbow takes to run through an edge's bend points in turn: across to each
 * point, then along to it, starting square to the side the connector leaves by.
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

/**
 * Joins a connector's ends to the layers its edge connects, routes it through the edge's bend
 * points, and gives it the edge's label where draw.io placed it. Labels beyond the first come
 * back for the caller to draw as text.
 */
export function bindEdge(
  graph: SceneGraph,
  { connector, edge, labels }: PendingEdge,
  layerOf: (cellId: string) => string | undefined
): DrawioCell[] {
  const straight = connector.connectorLineType === 'STRAIGHT'
  graph.updateNode(connector.id, {
    connectorStart: endpointOf(graph, layerOf, edge, 'source', straight),
    connectorEnd: endpointOf(graph, layerOf, edge, 'target', straight)
  })
  const own = edge.value ? [edge] : []
  const all = [...own, ...labels]
  const label = all.at(0)
  const extra = all.slice(1)
  const parts = connectorSublayers(graph, connector)
  // The label takes the edge's font even while empty, ready to be typed into.
  if (parts) graph.updateNode(parts.label.id, labelFields(edge.style))
  if (label && parts) {
    const format = labelFormat(label.style)
    const read = readLabel(label.value, label.style.values.html === '1', format)
    graph.updateNode(parts.label.id, {
      ...labelFields(label.style, format),
      text: read.text,
      styleRuns: read.runs
    })
    const at = label === edge ? edge.geometry.x : label.geometry.x
    graph.updateNode(connector.id, { connectorLabelPosition: labelPositionOf(at) })
  }
  layoutConnector(graph, connector)
  routeThroughPoints(graph, connector, edge.geometry.points)
  return extra
}

/** Bends an elbow or a curve through an edge's points, in the connector's parent's axes. */
function routeThroughPoints(graph: SceneGraph, connector: SceneNode, points: Vector[]) {
  if (points.length === 0) return
  const node = graph.getNode(connector.id)
  const route = node ? connectorRoute(graph, node) : null
  if (!node || !route) return
  const local = (point: Vector) => ({ x: point.x - node.x, y: point.y - node.y })
  if (node.connectorLineType === 'CURVED') {
    const curve = route.pieces.at(0)
    if (!curve) return
    // The curve bends so its middle passes the middle bend point.
    const through = points[Math.floor(points.length / 2)]
    const middle = curveMidpoint(curve)
    const [first, second] = dragCurve(curveControlPoints(curve), {
      x: through.x - middle.x,
      y: through.y - middle.y
    })
    graph.updateNode(node.id, { connectorCurveHandles: [local(first), local(second)] })
  } else {
    const across = route.sides[0] === 'LEFT' || route.sides[0] === 'RIGHT'
    graph.updateNode(node.id, {
      connectorControlPoints: elbowThrough(points, across).map((control) => ({
        ...control,
        position: local(control.position)
      }))
    })
  }
  const updated = graph.getNode(node.id)
  if (updated) layoutConnector(graph, updated)
}
