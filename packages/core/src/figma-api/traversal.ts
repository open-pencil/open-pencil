import type { SceneGraph } from '#core/scene-graph'
import type { FigmaNodeProxy, NodeProxyHost } from './proxy'

export function findAll(
  graph: SceneGraph,
  api: NodeProxyHost,
  rootId: string,
  callback?: (node: FigmaNodeProxy) => boolean
): FigmaNodeProxy[] {
  const results: FigmaNodeProxy[] = []
  const walk = (id: string) => {
    for (const child of graph.getChildren(id)) {
      const proxy = api.wrapNode(child.id)
      if (!callback || callback(proxy)) results.push(proxy)
      walk(child.id)
    }
  }
  walk(rootId)
  return results
}

export function findOne(
  graph: SceneGraph,
  api: NodeProxyHost,
  rootId: string,
  callback: (node: FigmaNodeProxy) => boolean
): FigmaNodeProxy | null {
  const walk = (id: string): FigmaNodeProxy | null => {
    for (const child of graph.getChildren(id)) {
      const proxy = api.wrapNode(child.id)
      if (callback(proxy)) return proxy
      const found = walk(child.id)
      if (found) return found
    }
    return null
  }
  return walk(rootId)
}

export function findChild(
  graph: SceneGraph,
  api: NodeProxyHost,
  rootId: string,
  callback: (node: FigmaNodeProxy) => boolean
): FigmaNodeProxy | null {
  for (const child of graph.getChildren(rootId)) {
    const proxy = api.wrapNode(child.id)
    if (callback(proxy)) return proxy
  }
  return null
}

export function findChildren(
  graph: SceneGraph,
  api: NodeProxyHost,
  rootId: string,
  callback?: (node: FigmaNodeProxy) => boolean
): FigmaNodeProxy[] {
  return graph
    .getChildren(rootId)
    .map((child) => api.wrapNode(child.id))
    .filter((proxy) => !callback || callback(proxy))
}

export function findAllWithCriteria(
  graph: SceneGraph,
  api: NodeProxyHost,
  rootId: string,
  criteria: { types?: string[] }
): FigmaNodeProxy[] {
  const types = criteria.types ? new Set(criteria.types) : null
  return findAll(graph, api, rootId, (node) => !types || types.has(node.type))
}
