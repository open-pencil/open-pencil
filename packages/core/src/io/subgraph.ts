import { SceneGraph } from '../scene-graph'

import type { ExportTarget } from './types'

export interface ExtractedGraph {
  graph: SceneGraph
  pageId: string | null
  nodeIds: string[]
}

function cloneIntoGraph(source: SceneGraph, ids: Set<string>): SceneGraph {
  const graph = new SceneGraph()
  const root = graph.getNode(graph.rootId)
  if (root) {
    root.childIds = []
    root.width = 0
    root.height = 0
  }
  graph.nodes = new Map()
  if (root) graph.nodes.set(root.id, root)
  graph.images = new Map(source.images)
  graph.variables = new Map()
  graph.variableCollections = new Map()
  graph.activeMode = new Map(source.activeMode)
  graph.figKiwiVersion = source.figKiwiVersion

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
    graph.nodes.set(id, structuredClone(node))
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

  const variableIds = new Set<string>()
  for (const node of graph.nodes.values()) {
    for (const variableId of Object.values(node.boundVariables)) {
      collectVariableClosure(source, variableId, variableIds)
    }
  }

  for (const variableId of variableIds) {
    const variable = source.variables.get(variableId)
    if (!variable) continue
    graph.variables.set(variableId, structuredClone(variable))
    const collection = source.variableCollections.get(variable.collectionId)
    if (!collection) continue
    const existing = graph.variableCollections.get(collection.id)
    if (!existing) {
      graph.variableCollections.set(collection.id, {
        ...structuredClone(collection),
        variableIds: []
      })
    }
    graph.variableCollections.get(collection.id)?.variableIds.push(variableId)
  }

  graph.clearAbsPosCache()
  return graph
}

function collectVariableClosure(source: SceneGraph, variableId: string, out: Set<string>) {
  if (out.has(variableId)) return
  const variable = source.variables.get(variableId)
  if (!variable) return
  out.add(variableId)
  for (const value of Object.values(variable.valuesByMode)) {
    if (typeof value === 'object' && 'aliasId' in value) {
      collectVariableClosure(source, value.aliasId, out)
    }
  }
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

function ancestorChain(source: SceneGraph, id: string): string[] {
  const chain: string[] = []
  let current = source.getNode(id)
  while (current?.parentId) {
    chain.push(current.parentId)
    current = source.getNode(current.parentId)
  }
  return chain.reverse()
}

function collectSelectionIds(source: SceneGraph, nodeIds: string[]): Set<string> {
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

  return ids
}

function pageNodeIds(source: SceneGraph, pageId: string): Set<string> {
  const ids = new Set<string>([source.rootId, pageId])
  collectDescendants(source, pageId, ids)
  return ids
}

function rootNodeIds(source: SceneGraph): Set<string> {
  const ids = new Set<string>()
  for (const node of source.nodes.values()) {
    ids.add(node.id)
  }
  return ids
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
