import {
  boundEndpoint,
  freeEndpoint,
  type ConnectorEndpoint,
  type ConnectorMagnet,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

/**
 * Where FigJam attaches a connector end dropped on a layer, measured on a 200 px square at 100%:
 * within 12 screen px inside its outline or 8 outside, the end holds to the outline and picks
 * left or right as the route needs; within 16 px of a side's midpoint it takes that side; inside,
 * the nearest of the side midpoints and the centre wins, the centre meaning any side.
 */
const OUTLINE_INSIDE = 12
const OUTLINE_OUTSIDE = 8
const MIDPOINT_SNAP = 16

/**
 * Layers whose children a connector end may attach to on their own, as FigJam looks into
 * sections; an end that misses every child attaches to the layer itself, except to a group.
 */
const PASS_THROUGH = new Set<SceneNode['type']>([
  'SECTION',
  'GROUP',
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/** The layer an end would attach to and how, for the canvas to highlight. */
export interface ConnectorTarget {
  nodeId: string
  magnet: ConnectorMagnet
}

type Side = 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT'

function sidePoints(box: Rect): [Side | 'AUTO', Vector][] {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  return [
    ['TOP', { x: cx, y: box.y }],
    ['RIGHT', { x: box.x + box.width, y: cy }],
    ['BOTTOM', { x: cx, y: box.y + box.height }],
    ['LEFT', { x: box.x, y: cy }],
    ['AUTO', { x: cx, y: cy }]
  ]
}

/** Signed distance from `point` to the box's outline: negative inside. */
function outlineDistance(box: Rect, point: Vector): number {
  const dx = Math.max(box.x - point.x, point.x - (box.x + box.width))
  const dy = Math.max(box.y - point.y, point.y - (box.y + box.height))
  if (dx <= 0 && dy <= 0) return Math.max(dx, dy)
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
}

/** The magnet a point on or near `box` picks, or null when it is too far outside. */
export function magnetAt(box: Rect, point: Vector, zoom: number): ConnectorMagnet | null {
  const distance = outlineDistance(box, point)
  if (distance > OUTLINE_OUTSIDE / zoom) return null
  const candidates = sidePoints(box).map(([magnet, at]) => ({
    magnet,
    distance: Math.hypot(at.x - point.x, at.y - point.y)
  }))
  const nearest = candidates.reduce((best, candidate) =>
    candidate.distance < best.distance ? candidate : best
  )
  if (distance >= -OUTLINE_INSIDE / zoom) {
    const side = candidates.find(
      (candidate) => candidate.magnet !== 'AUTO' && candidate.distance <= MIDPOINT_SNAP / zoom
    )
    return side?.magnet ?? 'AUTO_HORIZONTAL'
  }
  return nearest.magnet
}

function attachable(node: SceneNode): boolean {
  return node.visible && !node.locked && node.type !== 'CONNECTOR'
}

interface TargetSearch {
  pageId: string
  point: Vector
  zoom: number
  exclude: ReadonlySet<string>
  /** The layers the connector sits in: its canvas, which an end never attaches to. */
  around: ReadonlySet<string>
}

/** The topmost layer under `point` an end may attach to, looking into containers. */
function targetIn(
  graph: SceneGraph,
  parentId: string,
  search: TargetSearch
): { node: SceneNode; magnet: ConnectorMagnet } | null {
  const { pageId, point, zoom, exclude, around } = search
  const children = graph.getChildren(parentId)
  for (let index = children.length - 1; index >= 0; index--) {
    const node = children[index]
    if (!attachable(node) || exclude.has(node.id)) continue
    const box = getAxisAlignedBoundsInParent([node], pageId, graph)
    const magnet = magnetAt(box, point, zoom)
    if (!magnet) continue
    if (PASS_THROUGH.has(node.type)) {
      const inner = targetIn(graph, node.id, search)
      if (inner) return inner
      if (node.type === 'GROUP' || around.has(node.id)) continue
    }
    return { node, magnet }
  }
  return null
}

/** The layers `nodeId` sits in, below its page. */
function containersOf(graph: SceneGraph, nodeId: string | undefined): Set<string> {
  const containers = new Set<string>()
  for (
    let id = nodeId ? graph.getNode(nodeId)?.parentId : null;
    id;
    id = graph.getNode(id)?.parentId
  ) {
    if (graph.getNode(id)?.type === 'CANVAS') break
    containers.add(id)
  }
  return containers
}

/**
 * Where a connector end lands at `point`, in page coordinates: on the layer under it by the
 * magnet its position picks, or free at the point. Straight connectors attach by centres. An end
 * dropped on a layer the connector sits in stays free there, as FigJam leaves one in its section.
 */
export function connectorAttachment(
  graph: SceneGraph,
  pageId: string,
  point: Vector,
  options: { zoom: number; straight?: boolean; connectorId?: string }
): { endpoint: ConnectorEndpoint; target: ConnectorTarget | null } {
  const hit = targetIn(graph, pageId, {
    pageId,
    point,
    zoom: options.zoom,
    exclude: new Set(options.connectorId ? [options.connectorId] : []),
    around: containersOf(graph, options.connectorId)
  })
  if (!hit) return { endpoint: freeEndpoint(point.x, point.y), target: null }
  const magnet = options.straight ? 'CENTER' : hit.magnet
  return { endpoint: boundEndpoint(hit.node.id, magnet), target: { nodeId: hit.node.id, magnet } }
}
