import { recordInstanceOverride } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'

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

export function assertProxyEditable(target: ProxyThis, internals: NodeProxyInternals): void {
  assertNodeEditable(graph(target, internals), nodeId(target, internals))
}

export function updateNode(
  target: ProxyThis,
  internals: NodeProxyInternals,
  changes: Partial<SceneNode>
): void {
  assertProxyEditable(target, internals)
  const g = graph(target, internals)
  const id = nodeId(target, internals)
  const applied = Object.fromEntries(
    Object.keys(changes)
      .filter((key) => Reflect.get(changes, key) !== undefined)
      .map((key) => [key, Reflect.get(changes, key)])
  ) as Partial<SceneNode>
  if (Object.keys(applied).length === 0) return
  g.updateNode(id, applied)
  recordInstanceOverride(g, id, Object.keys(applied))
}
