import { clamp, minBy } from 'es-toolkit'

import type {
  ConnectorEndpoint,
  ConnectorMagnet,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import { boundEndpoint, freeEndpoint } from '@open-pencil/scene-graph/connectors'
import { getAxisAlignedBoundsInParent, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

/**
 * Where Figma Design attaches a connector end dropped on a layer, measured on 200 and 400 px
 * squares at 100% and 200%: within 8 screen px outside its outline, the end takes the side it is
 * past; inside, the nearest side, or any side within 24 units of the centre. Ties go to the top,
 * then right, bottom, and left.
 */
const OUTLINE_OUTSIDE = 8
const CENTRE_REACH = 24
/**
 * A section, measured in FigJam on a 400 × 320 one: within 12 screen px inside its outline the
 * end takes a side within 16 px of its midpoint, or holds to the outline and picks left or right
 * as the route needs; within 16 px of the centre it takes the nearest side, and elsewhere it is
 * pinned where it was dropped.
 */
const OUTLINE_INSIDE = 12
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

/** How far `point` is inside each side of `box`, in the order ties go: negative past it. */
function sideDepths(box: Rect, point: Vector): [Side, number][] {
  return [
    ['TOP', point.y - box.y],
    ['RIGHT', box.x + box.width - point.x],
    ['BOTTOM', box.y + box.height - point.y],
    ['LEFT', point.x - box.x]
  ]
}

/**
 * The magnet a point on or near `box` picks, or null when it is too far outside. A layer that
 * `pins` ends, as a section does, takes one dropped inside away from its centre as `ABSOLUTE`.
 */
export function magnetAt(
  box: Rect,
  point: Vector,
  zoom: number,
  pins = false
): ConnectorMagnet | null {
  const distance = outlineDistance(box, point)
  if (distance > OUTLINE_OUTSIDE / zoom) return null
  if (!pins) {
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    if (distance <= 0 && Math.hypot(point.x - centre.x, point.y - centre.y) < CENTRE_REACH) {
      return 'AUTO'
    }
    // Inside, the side nearest the point; outside, the side it is farthest past.
    return minBy(sideDepths(box, point), ([, depth]) => depth)?.[0] ?? 'AUTO'
  }
  return sectionMagnet(box, point, zoom, distance)
}

function sectionMagnet(box: Rect, point: Vector, zoom: number, distance: number): ConnectorMagnet {
  const candidates = sidePoints(box).map(([magnet, at]) => ({
    magnet,
    distance: Math.hypot(at.x - point.x, at.y - point.y)
  }))
  if (distance >= -OUTLINE_INSIDE / zoom) {
    // On a layer small enough for midpoints' reaches to overlap, the nearest one wins.
    const side = minBy(
      candidates.filter(
        (candidate) => candidate.magnet !== 'AUTO' && candidate.distance <= MIDPOINT_SNAP / zoom
      ),
      (candidate) => candidate.distance
    )
    return side?.magnet ?? 'AUTO_HORIZONTAL'
  }
  const centre = candidates[candidates.length - 1]
  if (centre.distance > MIDPOINT_SNAP / zoom) return 'ABSOLUTE'
  // Near the centre the nearest side midpoint wins, ties going to the top.
  return candidates
    .slice(0, -1)
    .reduce((best, candidate) => (candidate.distance < best.distance ? candidate : best)).magnet
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
    const magnet = magnetAt(box, point, zoom, node.type === 'SECTION')
    // A container that does not clip shows children beyond its box, which an end may reach.
    if (PASS_THROUGH.has(node.type) && (magnet || !node.clipsContent)) {
      const inner = targetIn(graph, node.id, search)
      if (inner) return inner
      if (node.type === 'GROUP' || around.has(node.id)) continue
    }
    if (!magnet) continue
    return { node, magnet }
  }
  return null
}

/** The layers `nodeId` sits in, below its page. */
function containersOf(graph: SceneGraph, nodeId: string | undefined): Set<string> {
  const containers = new Set<string>()
  const parentId = nodeId ? graph.getNode(nodeId)?.parentId : null
  if (!parentId) return containers
  // A walk that stops at the page, and at a parent cycle in a damaged document.
  graph.closest(parentId, (node) => {
    if (node.type === 'CANVAS') return true
    containers.add(node.id)
    return false
  })
  return containers
}

/** How the keys held while an end is dropped change where it attaches, as in Figma Design. */
export interface AttachModifiers {
  /** ⌘ or Ctrl: the end is pinned at the point on the layer, kept within its box. */
  pin?: boolean
  /** Shift: the end attaches to the layer's centre. */
  centre?: boolean
}

/** The magnet an end takes once its line type and the keys held have their say. */
function droppedMagnet(
  magnet: ConnectorMagnet,
  options: { straight?: boolean } & AttachModifiers
): ConnectorMagnet {
  if (options.straight || options.centre) return 'CENTER'
  return options.pin ? 'NONE' : magnet
}

/** `point` in `node`'s own axes, held within its box. */
function pointOn(graph: SceneGraph, node: SceneNode, point: Vector): Vector {
  const toLayer = Matrix.invert(getWorldMatrix(node, graph)) ?? Matrix.identity()
  const [x, y] = Matrix.mapPoints(toLayer, [point.x, point.y])
  return { x: clamp(x, 0, node.width), y: clamp(y, 0, node.height) }
}

/**
 * Where a connector end lands at `point`, in page coordinates: on the layer under it by the
 * magnet its position picks, pinned at the point in the layer's own axes, or free at the point.
 * Straight connectors attach by centres, as do ends dropped with `centre`; `pin` pins an end at
 * the point. An end dropped on a layer the connector sits in stays free there, as FigJam leaves
 * one in its section.
 */
export function connectorAttachment(
  graph: SceneGraph,
  pageId: string,
  point: Vector,
  options: { zoom: number; straight?: boolean; connectorId?: string } & AttachModifiers
): { endpoint: ConnectorEndpoint; target: ConnectorTarget | null } {
  const hit = targetIn(graph, pageId, {
    pageId,
    point,
    zoom: options.zoom,
    exclude: new Set(options.connectorId ? [options.connectorId] : []),
    around: containersOf(graph, options.connectorId)
  })
  if (!hit) return { endpoint: freeEndpoint(point.x, point.y), target: null }
  const magnet = droppedMagnet(hit.magnet, options)
  const target = { nodeId: hit.node.id, magnet }
  if (magnet !== 'ABSOLUTE' && magnet !== 'NONE') {
    return { endpoint: boundEndpoint(hit.node.id, magnet), target }
  }
  const position = pointOn(graph, hit.node, point)
  return { endpoint: { nodeId: hit.node.id, magnet, position }, target }
}
