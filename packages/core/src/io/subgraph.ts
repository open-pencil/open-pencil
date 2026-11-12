import { SceneGraph } from '@open-pencil/scene-graph'
import { copyImages } from '@open-pencil/scene-graph/images'
import {
  copyVariableTables,
  layerDependencies,
  type LayerDependencies
} from '@open-pencil/scene-graph/transfer'

import type { ExportTarget } from './types'

export interface ExtractOptions {
  /** Every variant of an instance's set, not only its main component, so it can switch variant. */
  componentSets?: boolean
  /**
   * Use the source's variables, collections, and images instead of copies, for a read-only view
   * rebuilt often, such as preview's. A copy may change its tables without touching the source.
   */
  shareTables?: boolean
}

export interface ExtractedGraph {
  graph: SceneGraph
  pageId: string | null
  nodeIds: string[]
}

function cloneIntoGraph(
  source: SceneGraph,
  ids: Set<string>,
  { shareTables = false }: ExtractOptions = {}
): SceneGraph {
  const graph = new SceneGraph()
  graph.rootId = source.rootId
  graph.nodes = new Map()
  graph.images = new Map()
  graph.variables = new Map()
  graph.variableCollections = new Map()
  graph.figKiwiVersion = source.figKiwiVersion
  graph.figSchemaDeflated = source.figSchemaDeflated
  graph.documentColorSpace = source.documentColorSpace
  graph.documentKind = source.documentKind

  const dependencies = layerDependencies(
    source,
    [...ids].flatMap((id) => source.getNode(id) ?? [])
  )
  for (const style of dependencies.styles) ids.add(style.id)

  const sortedIds = [...ids].sort((a, b) => {
    if (a === source.rootId) return -1
    if (b === source.rootId) return 1
    const aNode = source.getNode(a)
    const bNode = source.getNode(b)
    const aDepth = depthOf(source, aNode)
    const bDepth = depthOf(source, bNode)
    return aDepth - bDepth
  })

  for (const id of sortedIds) {
    const node = source.getNode(id)
    if (!node) continue
    const copy = structuredClone(node)
    graph.nodes.set(id, copy)
    // Syncing and swapping find an instance through its component's index.
    if (copy.type === 'INSTANCE' && copy.componentId) {
      const instances = graph.instanceIndex.get(copy.componentId) ?? new Set<string>()
      instances.add(id)
      graph.instanceIndex.set(copy.componentId, instances)
    }
    if (copy.type === 'CONNECTOR') graph.connectorIds.add(id)
  }

  const rootClone = graph.getNode(source.rootId)
  if (rootClone) {
    rootClone.parentId = null
    rootClone.childIds = rootClone.childIds.filter((id) => ids.has(id))
  }

  for (const id of sortedIds) {
    if (id === source.rootId) continue
    const node = graph.getNode(id)
    if (!node) continue
    if (!node.parentId || !ids.has(node.parentId)) {
      node.parentId = source.rootId
    }
    node.childIds = node.childIds.filter((childId) => ids.has(childId))
  }

  if (shareTables) {
    graph.images = source.images
    graph.variables = source.variables
    graph.variableCollections = source.variableCollections
  } else copyReferencedTables(source, graph, dependencies)

  graph.clearAbsPosCache()
  return graph
}

/** The images and variables the copied layers use, with their collections, copied in. */
function copyReferencedTables(
  source: SceneGraph,
  graph: SceneGraph,
  { images, variables, collections }: LayerDependencies
): void {
  copyImages(source.images, graph.images, images)
  copyVariableTables(graph, variables, collections, () => [source])
}

function depthOf(source: SceneGraph, node: ReturnType<SceneGraph['getNode']>): number {
  let depth = 0
  let current = node
  while (current?.parentId) {
    depth += 1
    current = source.getNode(current.parentId)
  }
  return depth
}

function collectDescendants(source: SceneGraph, id: string, out: Set<string>) {
  if (out.has(id)) return
  out.add(id)
  const node = source.getNode(id)
  if (!node) return
  for (const childId of node.childIds) {
    collectDescendants(source, childId, out)
  }
}

function collectAncestors(source: SceneGraph, id: string, out: Set<string>) {
  let current = source.getNode(id)
  while (current?.parentId) {
    out.add(current.parentId)
    current = source.getNode(current.parentId)
  }
}

function resolveInstanceComponentId(source: SceneGraph, componentId: string): string {
  const seen = new Set<string>()
  let currentId = componentId
  while (!seen.has(currentId)) {
    seen.add(currentId)
    const node = source.getNode(currentId)
    if (node?.type !== 'INSTANCE' || !node.componentId) return currentId
    currentId = node.componentId
  }
  return componentId
}

function collectComponentDependencies(
  source: SceneGraph,
  ids: Set<string>,
  { componentSets = false }: ExtractOptions = {}
) {
  let changed = true
  while (changed) {
    changed = false
    for (const id of Array.from(ids)) {
      const node = source.getNode(id)
      if (node?.type !== 'INSTANCE' || !node.componentId) continue
      const componentId = resolveInstanceComponentId(source, node.componentId)
      const component = source.getNode(componentId)
      const set = component?.parentId ? source.getNode(component.parentId) : undefined
      const dependency = componentSets && set?.type === 'COMPONENT_SET' ? set.id : componentId
      if (ids.has(dependency)) continue
      const before = ids.size
      collectAncestors(source, dependency, ids)
      collectDescendants(source, dependency, ids)
      changed ||= ids.size !== before
    }
  }
}

export function findPageId(source: SceneGraph, nodeId: string): string | null {
  let current = source.getNode(nodeId)
  while (current?.parentId) {
    const parent = source.getNode(current.parentId)
    if (!parent) return null
    if (parent.type === 'CANVAS') return parent.id
    current = parent
  }
  return current?.type === 'CANVAS' ? current.id : null
}

/** The page child containing `nodeId`, or the node itself when it is a page child. */
export function findPageChildId(source: SceneGraph, nodeId: string): string | null {
  let current = source.getNode(nodeId)
  while (current?.parentId) {
    const parent = source.getNode(current.parentId)
    if (parent?.type === 'CANVAS') return current.id
    current = parent
  }
  return null
}

function ancestorChain(source: SceneGraph, id: string): string[] {
  const chain: string[] = []
  let current = source.getNode(id)
  while (current?.parentId) {
    chain.push(current.parentId)
    current = source.getNode(current.parentId)
  }
  return chain.reverse()
}

function collectSelectionIds(
  source: SceneGraph,
  nodeIds: string[],
  options: ExtractOptions = {}
): Set<string> {
  const ids = new Set<string>([source.rootId])
  const pageIds = new Set<string>()

  for (const nodeId of nodeIds) {
    const node = source.getNode(nodeId)
    if (!node) continue
    for (const ancestorId of ancestorChain(source, nodeId)) {
      ids.add(ancestorId)
      const ancestor = source.getNode(ancestorId)
      if (ancestor?.type === 'CANVAS') pageIds.add(ancestorId)
    }
    collectDescendants(source, nodeId, ids)
  }

  for (const pageId of pageIds) {
    ids.add(pageId)
  }

  collectComponentDependencies(source, ids, options)
  return ids
}

function pageNodeIds(source: SceneGraph, pageId: string): Set<string> {
  const ids = new Set<string>([source.rootId])
  collectDescendants(source, pageId, ids)
  collectComponentDependencies(source, ids)
  return ids
}

function rootNodeIds(source: SceneGraph): Set<string> {
  const ids = new Set<string>()
  for (const node of source.nodes.values()) {
    ids.add(node.id)
  }
  return ids
}

/** Clone `pageId` with only the subtrees of `nodeIds` (none keeps an empty page) and their dependencies. */
export function extractPageContext(
  source: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: ExtractOptions = {}
): SceneGraph {
  const ids = collectSelectionIds(source, nodeIds, options)
  ids.add(pageId)
  return cloneIntoGraph(source, ids, options)
}

export function extractExportGraph(source: SceneGraph, target: ExportTarget): ExtractedGraph {
  switch (target.scope) {
    case 'document': {
      const graph = cloneIntoGraph(source, rootNodeIds(source))
      return {
        graph,
        pageId: graph.getPages()[0]?.id ?? null,
        nodeIds: graph.getPages()[0]?.childIds ?? []
      }
    }
    case 'page': {
      const graph = cloneIntoGraph(source, pageNodeIds(source, target.pageId))
      const page = graph.getNode(target.pageId)
      return {
        graph,
        pageId: page?.id ?? null,
        nodeIds: page?.childIds ?? []
      }
    }
    case 'selection': {
      const graph = cloneIntoGraph(source, collectSelectionIds(source, target.nodeIds))
      const firstId = target.nodeIds[0]
      const first = firstId ? source.getNode(firstId) : undefined
      const pageId = first
        ? (ancestorChain(source, first.id).find((id) => source.getNode(id)?.type === 'CANVAS') ??
          null)
        : null
      return {
        graph,
        pageId,
        nodeIds: target.nodeIds.filter((id) => graph.getNode(id) !== undefined)
      }
    }
    case 'node':
      return extractExportGraph(source, { scope: 'selection', nodeIds: [target.nodeId] })
    default:
      return extractExportGraph(source, { scope: 'document' })
  }
}
