import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api'
import { groupBy } from 'es-toolkit'

import type { ConnectorSide } from '@open-pencil/scene-graph/connectors'
import type { Rect, Size, Vector } from '@open-pencil/scene-graph/primitives'

import { layoutWithElk } from './elk'

/**
 * How boxes are arranged, by the ELK algorithm behind each:
 * - `spread` pushes overlapping boxes apart, keeping them near where they were (SPOrE overlap
 *   removal);
 * - `compact` spreads them and then closes the gaps, keeping their relative places (SPOrE
 *   compaction);
 * - `pack` packs them into rows in their order (rectangle packing);
 * - `flow` ranks them along their edges with right-angled routes (layered);
 * - `tree` lays a tree out from its roots (Mr. Tree);
 * - `radial` lays a tree out in rings around its root (radial);
 * - `network` places joined boxes near each other, with no direction (stress).
 */
export type BoxLayout = 'spread' | 'compact' | 'pack' | 'flow' | 'tree' | 'radial' | 'network'

/** The way a flow or a tree runs: top to bottom, bottom to top, left to right, or right to left. */
export type ArrangeDirection = 'TB' | 'BT' | 'LR' | 'RL'

/** A box or group, at the top or inside the group it names. */
export interface ArrangeMember {
  id: string
  group?: string
  /** Where it is now, in the arrangement's axes, which `spread` and `compact` start from. */
  position?: Vector
}

export interface ArrangeBox extends ArrangeMember, Size {}

/** A box around boxes and other groups, sized to hold them. */
export type ArrangeGroup = ArrangeMember

/** An edge between two boxes or groups; its label, by size, gets room along it in a flow. */
export interface ArrangeEdge {
  id: string
  from: string
  to: string
  label?: Size
}

export interface ArrangeInput {
  layout: BoxLayout
  /** For `flow` and `tree`; top to bottom unless given. */
  direction?: ArrangeDirection
  /** Room between boxes; ranks of a flow get half as much again. */
  spacing?: number
  boxes: ArrangeBox[]
  groups: ArrangeGroup[]
  edges: ArrangeEdge[]
}

/** The way a flow's edge runs: the sides it leaves and enters by, and its corners between them. */
export interface ArrangedRoute {
  startSide: ConnectorSide
  endSide: ConnectorSide
  /**
   * From its start, on the middle of `startSide`, to its end, on the middle of `endSide`; empty
   * when only the sides are given.
   */
  points: Vector[]
}

/**
 * Where everything went, in the arrangement's axes. A flow routes its edges, a tree gives only the
 * sides its own edges leave and enter by, and other layouts leave edges to the connectors.
 */
export interface Arrangement {
  boxes: Map<string, Rect>
  groups: Map<string, Rect>
  edges: Map<string, ArrangedRoute>
}

const SPACING = 40
/** Room inside a group around what it holds, and above it for the group's title. */
const GROUP_PADDING = 24
const GROUP_TITLE = 48

const ALGORITHMS: Record<BoxLayout, string> = {
  spread: 'sporeOverlap',
  compact: 'sporeCompaction',
  pack: 'rectpacking',
  flow: 'layered',
  tree: 'mrtree',
  radial: 'radial',
  network: 'stress'
}

const ELK_DIRECTION: Record<ArrangeDirection, string> = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT'
}

/** The side a flow's edges leave a box by, and the side they enter one by. */
const FLOW_SIDES: Record<ArrangeDirection, [ConnectorSide, ConnectorSide]> = {
  TB: ['BOTTOM', 'TOP'],
  BT: ['TOP', 'BOTTOM'],
  LR: ['RIGHT', 'LEFT'],
  RL: ['LEFT', 'RIGHT']
}

const ELK_SIDE: Record<ConnectorSide, string> = {
  TOP: 'NORTH',
  RIGHT: 'EAST',
  BOTTOM: 'SOUTH',
  LEFT: 'WEST'
}

function portId(boxId: string, side: ConnectorSide): string {
  return `${boxId}\u0000${side}`
}

/**
 * A port on the middle of each side a box's edges use, fixed there: connectors attach to side
 * midpoints, so ELK routes every edge to where its connector will meet the box.
 */
function ports(boxId: string, size: Size, sides: ConnectorSide[]): ElkPort[] {
  const at: Record<ConnectorSide, Vector> = {
    TOP: { x: size.width / 2, y: 0 },
    RIGHT: { x: size.width, y: size.height / 2 },
    BOTTOM: { x: size.width / 2, y: size.height },
    LEFT: { x: 0, y: size.height / 2 }
  }
  return sides.map((side) => ({
    id: portId(boxId, side),
    ...at[side],
    width: 0,
    height: 0,
    layoutOptions: { 'elk.port.side': ELK_SIDE[side] }
  }))
}

/** Each box's place in the input: a box's own, a group's that of its first member. */
function inputOrder(input: ArrangeInput): Map<string, number> {
  const order = new Map<string, number>()
  const groupOf = new Map(input.groups.map((group) => [group.id, group.group]))
  for (const [index, box] of input.boxes.entries()) {
    order.set(box.id, index)
    for (let group = box.group; group !== undefined; group = groupOf.get(group)) {
      if (!order.has(group)) order.set(group, index)
    }
  }
  return order
}

/**
 * The edges of a spanning forest of the boxes and groups, taken breadth first from those no edge
 * enters, in the input's order, then from the first still unreached: the tree a tree or radial layout
 * lays out. ELK's radial layout recurses without end on a loop, and a tree reads from its start;
 * the edges left out, such as one looping back, still join their boxes. Only edges within one
 * group count, as these layouts arrange each group on its own.
 */
function treeEdges(input: ArrangeInput): Set<string> {
  // A group laid out around its members is a node of its parent's layout, as a box is.
  const order = inputOrder(input)
  const members = [...input.groups, ...input.boxes].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  )
  const groupOf = new Map(members.map((member) => [member.id, member.group]))
  const edges = input.edges.filter(
    (edge) =>
      edge.from !== edge.to &&
      groupOf.has(edge.from) &&
      groupOf.has(edge.to) &&
      groupOf.get(edge.from) === groupOf.get(edge.to)
  )
  const outgoing = groupBy(edges, (edge) => edge.from)
  const entered = new Set(edges.map((edge) => edge.to))
  const starts = [
    ...members.filter((member) => !entered.has(member.id)),
    ...members.filter((member) => entered.has(member.id))
  ]
  const reached = new Set<string>()
  const tree = new Set<string>()
  for (const start of starts) {
    if (reached.has(start.id)) continue
    reached.add(start.id)
    const queue = [start.id]
    for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
      // An id such as `constructor` must not read a property every object has.
      for (const edge of Object.hasOwn(outgoing, at) ? outgoing[at] : []) {
        if (reached.has(edge.to)) continue
        reached.add(edge.to)
        tree.add(edge.id)
        queue.push(edge.to)
      }
    }
  }
  return tree
}

/** The edges ELK lays out: a tree or radial layout's tree, every edge for the others. */
function laidOutEdges(input: ArrangeInput): ArrangeInput['edges'] {
  if (input.layout !== 'tree' && input.layout !== 'radial') return input.edges
  const tree = treeEdges(input)
  return input.edges.filter((edge) => tree.has(edge.id))
}

/** The layout options of the root and of each group, for the input's layout. */
function layoutOptions(input: ArrangeInput): Record<string, string> {
  const spacing = input.spacing ?? SPACING
  const direction = ELK_DIRECTION[input.direction ?? 'TB']
  const common = {
    'elk.algorithm': ALGORITHMS[input.layout],
    'elk.spacing.nodeNode': String(spacing),
    'elk.spacing.componentComponent': String(spacing),
    'elk.padding': `[top=${GROUP_TITLE},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`
  }
  switch (input.layout) {
    case 'flow':
      return {
        ...common,
        'elk.direction': direction,
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.5),
        'elk.spacing.edgeNode': '20',
        'elk.spacing.edgeEdge': '12',
        'elk.layered.spacing.edgeNodeBetweenLayers': '20',
        // Flowcharts read from their first node: break cycles along the order they were written
        // in, rather than where ELK's greedy pass would, which can put the start mid-drawing.
        'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.edgeLabels.placement': 'CENTER'
      }
    case 'tree':
      return {
        ...common,
        'elk.direction': direction,
        'elk.mrtree.spacing.nodeNode': String(spacing)
      }
    case 'network':
      return { ...common, 'elk.stress.desiredEdgeLength': String(spacing * 4) }
    default:
      return common
  }
}

function elkGraph(input: ArrangeInput): ElkNode {
  const flow = input.layout === 'flow'
  const [outSide, inSide] = FLOW_SIDES[input.direction ?? 'TB']
  const options = layoutOptions(input)
  const elk = new Map<string, ElkNode>()
  for (const group of input.groups) {
    elk.set(group.id, {
      id: group.id,
      ...group.position,
      children: [],
      edges: [],
      layoutOptions: flow ? { ...options, 'elk.portConstraints': 'FIXED_SIDE' } : options,
      ports: flow
        ? [
            {
              id: portId(group.id, outSide),
              layoutOptions: { 'elk.port.side': ELK_SIDE[outSide] }
            },
            { id: portId(group.id, inSide), layoutOptions: { 'elk.port.side': ELK_SIDE[inSide] } }
          ]
        : []
    })
  }
  for (const box of input.boxes) {
    elk.set(box.id, {
      id: box.id,
      ...box.position,
      width: box.width,
      height: box.height,
      layoutOptions: flow ? { 'elk.portConstraints': 'FIXED_POS' } : {},
      ports: flow ? ports(box.id, box, [outSide, inSide]) : []
    })
  }
  const root: ElkNode = {
    id: '\u0000root',
    layoutOptions: { ...options, 'elk.json.shapeCoords': 'ROOT', 'elk.json.edgeCoords': 'ROOT' },
    children: [],
    edges: []
  }
  const groupOf = new Map(
    [...input.groups, ...input.boxes].map((member) => [member.id, member.group])
  )
  const container = (group: string | undefined) => (group ? elk.get(group) : undefined) ?? root
  // ELK keeps the order it is given, so boxes go in the input's order: a box where it appears, a
  // group where its first member does.
  const order = inputOrder(input)
  const members = [...input.groups, ...input.boxes].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  )
  for (const member of members) {
    const node = elk.get(member.id)
    if (node) container(member.group).children?.push(node)
  }
  for (const edge of laidOutEdges(input)) {
    if (!elk.has(edge.from) || !elk.has(edge.to)) continue
    if (flow) {
      root.edges?.push({
        id: edge.id,
        sources: [portId(edge.from, outSide)],
        targets: [portId(edge.to, inSide)],
        // ELK skips a label without text; only its size matters here.
        labels: edge.label ? [{ text: edge.id, ...edge.label }] : []
      })
      continue
    }
    // Other layouts arrange each group on its own, so an edge counts only between boxes that
    // share one.
    const group = groupOf.get(edge.from)
    if (group !== groupOf.get(edge.to)) continue
    container(group).edges?.push({ id: edge.id, sources: [edge.from], targets: [edge.to] })
  }
  return root
}

function sideOf(point: Vector, box: Rect): ConnectorSide {
  const distances: [ConnectorSide, number][] = [
    ['TOP', Math.abs(point.y - box.y)],
    ['RIGHT', Math.abs(point.x - (box.x + box.width))],
    ['BOTTOM', Math.abs(point.y - (box.y + box.height))],
    ['LEFT', Math.abs(point.x - box.x)]
  ]
  return distances.reduce((best, entry) => (entry[1] < best[1] ? entry : best))[0]
}

function rectOf(node: ElkNode): Rect {
  return { x: node.x ?? 0, y: node.y ?? 0, width: node.width ?? 0, height: node.height ?? 0 }
}

function collect(result: ElkNode, input: ArrangeInput): Arrangement {
  const groupIds = new Set(input.groups.map((group) => group.id))
  const arrangement: Arrangement = { boxes: new Map(), groups: new Map(), edges: new Map() }
  const walk = (node: ElkNode) => {
    for (const child of node.children ?? []) {
      ;(groupIds.has(child.id) ? arrangement.groups : arrangement.boxes).set(
        child.id,
        rectOf(child)
      )
      walk(child)
    }
  }
  walk(result)
  if (input.layout === 'tree') {
    // A tree runs one way, so its own edges leave and enter boxes by the sides a flow would, with
    // the connectors' own elbows between them. An edge outside the tree, such as one looping
    // back up, picks its sides itself rather than running the length of a branch.
    const [startSide, endSide] = FLOW_SIDES[input.direction ?? 'TB']
    const tree = treeEdges(input)
    for (const edge of input.edges) {
      if (tree.has(edge.id) && arrangement.boxes.has(edge.from) && arrangement.boxes.has(edge.to)) {
        arrangement.edges.set(edge.id, { startSide, endSide, points: [] })
      }
    }
    return arrangement
  }
  if (input.layout !== 'flow') return arrangement
  const ends = new Map(input.edges.map((edge) => [edge.id, edge]))
  const placed = new Map([...arrangement.groups, ...arrangement.boxes])
  // ELK may hand an edge back in the group that holds both its ends.
  const edgesOf = (node: ElkNode): ElkExtendedEdge[] => [
    ...(node.edges ?? []),
    ...(node.children ?? []).flatMap(edgesOf)
  ]
  for (const edge of edgesOf(result)) {
    const ended = ends.get(edge.id)
    const from = ended && placed.get(ended.from)
    const to = ended && placed.get(ended.to)
    const points = (edge.sections ?? []).flatMap((section) => [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint
    ])
    const first = points.at(0)
    const last = points.at(-1)
    if (!from || !to || !first || !last) continue
    arrangement.edges.set(edge.id, {
      startSide: sideOf(first, from),
      endSide: sideOf(last, to),
      points: points.map(({ x, y }) => ({ x, y }))
    })
  }
  return arrangement
}

/** The input again, each box and group where `result` put it, for a second pass to start from. */
function placedAt(input: ArrangeInput, result: ElkNode): ArrangeInput {
  const positions = new Map<string, Vector>()
  const walk = (node: ElkNode) => {
    for (const child of node.children ?? []) {
      positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
      walk(child)
    }
  }
  walk(result)
  const at = <Member extends ArrangeMember>(member: Member): Member => ({
    ...member,
    position: positions.get(member.id) ?? member.position
  })
  return { ...input, boxes: input.boxes.map(at), groups: input.groups.map(at) }
}

/**
 * Arranges boxes with ELK in the input's layout: groups around their members, and, in a flow,
 * every edge routed at right angles from the middle of the side it leaves by to the middle of the
 * side it enters by.
 */
export async function arrangeBoxes(input: ArrangeInput): Promise<Arrangement> {
  if (input.layout === 'compact') {
    // Compaction keeps boxes apart only once they are: spread them first.
    const spread = await layoutWithElk(elkGraph({ ...input, layout: 'spread' }))
    const compacted = placedAt(input, spread)
    return collect(await layoutWithElk(elkGraph(compacted)), compacted)
  }
  if (input.layout === 'radial' || input.layout === 'network') {
    // These place boxes by their centres alone, so wide boxes can land on each other: pull them
    // apart afterwards, as a spread does, keeping each near where the layout put it.
    const placed = placedAt(input, await layoutWithElk(elkGraph(input)))
    return collect(await layoutWithElk(elkGraph({ ...placed, layout: 'spread' })), placed)
  }
  return collect(await layoutWithElk(elkGraph(input)), input)
}
