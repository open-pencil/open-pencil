import { uniq } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { connectorsAffectedBy, layoutConnector } from '@open-pencil/scene-graph/connectors'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { applyArrangement } from './apply'
import {
  arrangeBoxes,
  type ArrangeDirection,
  type ArrangeEdge,
  type ArrangeInput,
  type BoxLayout
} from './boxes'
import { connectorLabelSize } from './routes'

/**
 * How layers are arranged: an ELK layout (see `BoxLayout`), or in a grid, a row, or a column in
 * the order given, starting where the first layer is.
 */
export type LayerLayout = BoxLayout | 'grid' | 'row' | 'column'

export interface ArrangeLayersOptions {
  layout: LayerLayout
  /** For `flow` and `tree`. */
  direction?: ArrangeDirection
  /** Room between layers. */
  spacing?: number
  /** Columns of a grid; as many as make it square unless given. */
  columns?: number
}

/** What an arrangement moved. */
export interface LayerArrangement {
  /** Layers placed as boxes. */
  layers: number
  /** Sections laid out around what they hold. */
  groups: number
  /** Connectors routed or joined anew. */
  connectors: number
}

const SPACING = 40

/**
 * A chosen section lays out around its children when all of them were chosen too; a section
 * holding anything else moves as one box, so what was not chosen stays as it was.
 */
function groupsAmong(graph: SceneGraph, chosen: Set<string>): Set<string> {
  const groups = new Set<string>()
  for (const id of chosen) {
    const node = graph.getNode(id)
    if (node?.type !== 'SECTION') continue
    const children = graph.getChildren(id).filter((child) => child.type !== 'CONNECTOR')
    if (children.length > 0 && children.every((child) => chosen.has(child.id))) groups.add(id)
  }
  return groups
}

/**
 * Whether a chosen layer sits inside another chosen layer that moves as one box, rather than one
 * laid out around its children, and so moves with it.
 */
function movesWithAncestor(
  graph: SceneGraph,
  node: SceneNode,
  given: SceneNode[],
  groups: Set<string>
): boolean {
  const ids = new Set(given.map((candidate) => candidate.id))
  for (
    let ancestor = node.parentId ? graph.getNode(node.parentId) : undefined;
    ancestor;
    ancestor = ancestor.parentId ? graph.getNode(ancestor.parentId) : undefined
  ) {
    if (ids.has(ancestor.id) && !groups.has(ancestor.id)) return true
  }
  return false
}

/** The chosen layer a connector end joins: the layer itself, or the nearest chosen ancestor. */
function chosenOwner(graph: SceneGraph, nodeId: string, chosen: Set<string>): string | null {
  for (
    let node = graph.getNode(nodeId);
    node;
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  ) {
    if (chosen.has(node.id)) return node.id
  }
  return null
}

/** Lays layers out in a grid, a row, or a column, in their order, from where the first is. */
function line(nodes: SceneNode[], graph: SceneGraph, options: ArrangeLayersOptions): void {
  const spacing = options.spacing ?? SPACING
  const first = nodes.at(0)
  if (!first) return
  let columns = options.columns ?? Math.ceil(Math.sqrt(nodes.length))
  if (options.layout === 'row') columns = nodes.length
  if (options.layout === 'column') columns = 1
  let x = first.x
  let y = first.y
  let rowHeight = 0
  for (const [index, node] of nodes.entries()) {
    if (index > 0 && index % columns === 0) {
      x = first.x
      y += rowHeight + spacing
      rowHeight = 0
    }
    graph.updateNode(node.id, { x, y })
    x += node.width + spacing
    rowHeight = Math.max(rowHeight, node.height)
  }
}

/** The connectors between chosen layers, as edges, and those joined to the layers themselves. */
function connectorEdges(graph: SceneGraph, pageId: string, chosen: Set<string>) {
  const edges: ArrangeEdge[] = []
  const joined = new Map<string, string>()
  for (const { node } of graph.flattenTree(pageId)) {
    if (node.type !== 'CONNECTOR') continue
    const startId = node.connectorStart?.nodeId
    const endId = node.connectorEnd?.nodeId
    if (!startId || !endId) continue
    const from = chosenOwner(graph, startId, chosen)
    const to = chosenOwner(graph, endId, chosen)
    if (!from || !to || from === to) continue
    edges.push({ id: node.id, from, to, label: connectorLabelSize(graph, node.id) ?? undefined })
    // Only a connector joined to the boxes themselves is joined anew; one joined inside a box
    // keeps where it attaches.
    if (from === startId && to === endId) joined.set(node.id, node.id)
  }
  return { edges, joined }
}

/**
 * What an arrangement read from the graph: each layer's parent and box, each chosen section's
 * children, and the connectors between the layers with their ends, line types, and label sizes,
 * so a result computed from them can tell whether they still hold.
 */
function readFrom(
  graph: SceneGraph,
  pageId: string,
  nodes: SceneNode[],
  groups: Set<string>
): string {
  const chosen = new Set(nodes.map((node) => node.id))
  const layer = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return null
    const box = [node.parentId, node.x, node.y, node.width, node.height]
    return groups.has(id) ? [...box, node.childIds] : box
  }
  // Everything the arrangement reads from a connector or rewrites on it.
  const connector = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return null
    return [
      id,
      node.parentId,
      node.connectorStart,
      node.connectorEnd,
      node.connectorLineType,
      connectorLabelSize(graph, id)
    ]
  }
  return JSON.stringify([
    nodes.map((node) => layer(node.id)),
    connectorEdges(graph, pageId, chosen).edges.map((edge) => connector(edge.id))
  ])
}

/**
 * Arranges the layers `ids` in `options.layout`. ELK layouts take the connectors that join the
 * layers into account: each layer is a box at its own size, each chosen section is laid out
 * around the chosen layers it holds, and the whole keeps its top-left corner. Layers not inside a
 * chosen section must share a parent. Connectors are found, not chosen: those joined to the
 * layers are joined anew, routed when they flow, and any other connector on what moved follows.
 * Throws, moving nothing, when the layers change while the layout runs.
 */
function chosenLayers(graph: SceneGraph, ids: string[]) {
  const given = uniq(ids)
    .map((id) => graph.getNode(id))
    .filter(
      (node): node is SceneNode =>
        node !== undefined && node.type !== 'CONNECTOR' && node.type !== 'CANVAS'
    )
  const groups = groupsAmong(graph, new Set(given.map((node) => node.id)))
  // A layer inside another chosen layer that is not laid out around it moves with that layer.
  const nodes = given.filter((node) => !movesWithAncestor(graph, node, given, groups))
  const inGroup = (node: SceneNode) => node.parentId !== null && groups.has(node.parentId)
  return { nodes, groups, inGroup, top: nodes.filter((node) => !inGroup(node)) }
}

function isLine(layout: LayerLayout) {
  return layout === 'grid' || layout === 'row' || layout === 'column'
}

/** Why `arrangeLayers` would refuse these layers with `layout`, or null when it takes them. */
export function arrangeProblem(
  graph: SceneGraph,
  ids: string[],
  layout: LayerLayout
): string | null {
  const { nodes, top } = chosenLayers(graph, ids)
  // Grid, row, and column place layers in their parents' axes, so the layers must share one.
  if (isLine(layout)) {
    return new Set(nodes.map((node) => node.parentId)).size > 1
      ? 'Layers to place in a grid, row, or column must share a parent'
      : null
  }
  return new Set(top.map((node) => node.parentId)).size > 1
    ? 'Layers to arrange must share a parent, apart from those in chosen sections'
    : null
}

/**
 * Runs the synchronous step that moves layers; an editor wraps it to record one undo step for
 * the moves alone, after the asynchronous layout has finished.
 */
export type ArrangeCommit = (apply: () => void) => void

export async function arrangeLayers(
  graph: SceneGraph,
  ids: string[],
  options: ArrangeLayersOptions,
  commit: ArrangeCommit = (apply) => apply()
): Promise<LayerArrangement> {
  const problem = arrangeProblem(graph, ids, options.layout)
  if (problem) throw new Error(problem)
  const { nodes, groups, inGroup, top } = chosenLayers(graph, ids)
  const chosen = new Set(nodes.map((node) => node.id))
  const relayout = () => {
    const moved = connectorsAffectedBy(graph, chosen)
    for (const connector of moved) {
      const current = graph.getNode(connector.id)
      if (current) layoutConnector(graph, current)
    }
    return moved.length
  }
  if (isLine(options.layout)) {
    let connectors = 0
    commit(() => {
      line(nodes, graph, options)
      connectors = relayout()
    })
    return { layers: nodes.length, groups: 0, connectors }
  }

  const pageId = top[0] ? graph.pageOf(top[0].id) : null
  if (!pageId) return { layers: 0, groups: 0, connectors: 0 }

  // Where each layer is now, in the shared parent's axes, for the layouts that keep places.
  const position = (node: SceneNode): Vector => {
    const parent = inGroup(node) && node.parentId ? graph.getNode(node.parentId) : undefined
    const offset = parent ? position(parent) : { x: 0, y: 0 }
    return { x: offset.x + node.x, y: offset.y + node.y }
  }
  const { edges, joined } = connectorEdges(graph, pageId, chosen)
  const groupOf = (node: SceneNode) => (inGroup(node) ? (node.parentId ?? undefined) : undefined)
  const input: ArrangeInput = {
    layout: options.layout,
    direction: options.direction,
    spacing: options.spacing,
    boxes: nodes
      .filter((node) => !groups.has(node.id))
      .map((node) => ({
        id: node.id,
        width: node.width,
        height: node.height,
        position: position(node),
        group: groupOf(node)
      })),
    groups: nodes
      .filter((node) => groups.has(node.id))
      .map((node) => ({ id: node.id, position: position(node), group: groupOf(node) })),
    edges
  }
  const topLeft = {
    x: Math.min(...top.map((node) => node.x)),
    y: Math.min(...top.map((node) => node.y))
  }
  const before = readFrom(graph, pageId, nodes, groups)
  const arrangement = await arrangeBoxes(input)
  // Someone may have moved or removed a layer while the layout ran; its result is stale then.
  if (readFrom(graph, pageId, nodes, groups) !== before) {
    throw new Error('The layers changed while they were being arranged; nothing was moved')
  }
  commit(() => {
    applyArrangement(
      graph,
      input,
      arrangement,
      { boxes: new Map(nodes.map((node) => [node.id, node.id])), connectors: joined },
      { topLeft }
    )
    relayout()
  })
  return { layers: input.boxes.length, groups: input.groups.length, connectors: joined.size }
}
