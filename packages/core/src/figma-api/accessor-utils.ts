import type { SceneGraph, SceneNode } from '#core/scene-graph'

export interface NodeProxyInternals {
  id: symbol
  graph: symbol
  api: symbol
}

export type ProxyThis = Record<symbol, unknown>

export function nodeId(target: ProxyThis, internals: NodeProxyInternals): string {
  return target[internals.id] as string
}

export function graph(target: ProxyThis, internals: NodeProxyInternals): SceneGraph {
  return target[internals.graph] as SceneGraph
}

export function raw(target: ProxyThis, internals: NodeProxyInternals): SceneNode {
  const id = nodeId(target, internals)
  const node = graph(target, internals).getNode(id)
  if (!node) throw new Error(`Node ${id} has been removed`)
  return node
}

export function updateNode(
  target: ProxyThis,
  internals: NodeProxyInternals,
  changes: Partial<SceneNode>
): void {
  graph(target, internals).updateNode(nodeId(target, internals), changes)
}
