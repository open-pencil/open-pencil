import {
  fitEnclosingGroups,
  FITTED_CONTAINER_TYPES,
  recordInstanceOverride
} from '@open-pencil/scene-graph'
import type { GroupFitOptions, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { NodeProxyHost } from '#core/figma-api/proxy'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'

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

/** Fields whose change can move a node's bounds, so the groups around it refit. */
const GEOMETRY_FIELDS: ReadonlySet<string> = new Set([
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'flipX',
  'flipY'
])

/** Refits the groups around a node's parent, as Figma does after a script changes it. */
export function fitGroupsAround(
  graph: SceneGraph,
  parentId: string | null | undefined,
  options: GroupFitOptions
): void {
  const parent = parentId ? graph.getNode(parentId) : undefined
  if (parent && FITTED_CONTAINER_TYPES.has(parent.type)) {
    fitEnclosingGroups(graph, [parent.id], options)
  }
}

/** Refit options of the API a proxy belongs to. */
export function hostFitOptions(target: ProxyThis, internals: NodeProxyInternals): GroupFitOptions {
  return (target[internals.api] as NodeProxyHost).groupFitOptions
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
  // Auto-sizing text measures its new content, as the editor's updates do.
  Object.assign(applied, textAutoResizeChanges(g.getNode(id), applied))
  g.updateNode(id, applied)
  recordInstanceOverride(g, id, Object.keys(applied))
  if (Object.keys(applied).some((key) => GEOMETRY_FIELDS.has(key))) {
    fitGroupsAround(g, g.getNode(id)?.parentId, hostFitOptions(target, internals))
  }
}
