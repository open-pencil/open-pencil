import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { connectorSublayers } from '@open-pencil/scene-graph/connectors'
import { fitEnclosingGroups, type GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { FITTED_CONTAINER_TYPES } from '@open-pencil/scene-graph/node-defaults'
import { styleDetachmentChanges } from '@open-pencil/scene-graph/shared-styles'
import { claimSlotContent, slotScope } from '@open-pencil/scene-graph/slots'

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

/**
 * The layer a node's strokes live on, as a proxy target: a connector keeps its stroke on its
 * line, which Figma presents as the connector's own.
 */
export function strokeOwner(target: ProxyThis, internals: NodeProxyInternals): ProxyThis {
  const node = raw(target, internals)
  if (node.type !== 'CONNECTOR') return target
  const line = connectorSublayers(graph(target, internals), node)?.line
  if (!line) return target
  const owner: ProxyThis = Object.create(target)
  owner[internals.id] = line.id
  return owner
}

export function assertProxyEditable(target: ProxyThis, internals: NodeProxyInternals): void {
  assertNodeEditable(graph(target, internals), nodeId(target, internals))
}

/**
 * Readies an edit to a field a layer inside an instance always takes from its component. Figma
 * refuses it there, naming the setter and the property it would have overridden (Figma desktop
 * 126); an async method's rejection names no setter, so it passes none. Slot content is the
 * instance's own and keeps the edit: a slot still showing the component's default content is
 * claimed first, as Figma does on the first edit, so a later sync leaves it alone.
 */
export function prepareFollowedFieldEdit(
  scene: SceneGraph,
  node: SceneNode,
  setter: string | null,
  property:
    | 'relative-transform'
    | 'vertical-constraint'
    | 'is-mask'
    | 'mask-type'
    | 'vector-data'
    | 'handle-mirroring'
    | 'stack-counter-align-content'
    | 'shape-type'
): void {
  if (!node.parentId) return
  const scope = slotScope(scene, node.parentId)
  if (scope.kind === 'locked') {
    const message = `This property cannot be overridden in an instance: ${property}`
    throw new Error(setter ? `in set_${setter}: ${message}` : message)
  }
  if (scope.kind === 'slot') claimSlotContent(scene, scope)
}

/** Fields whose change can move a node's bounds or drop it from its group's, so groups refit. */
const GEOMETRY_FIELDS: ReadonlySet<string> = new Set([
  'visible',
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
  const before = g.getNode(id)
  // Auto-sizing text measures its new content, as the editor's updates do.
  Object.assign(applied, textAutoResizeChanges(before, applied))
  // An edit to a style's fields leaves that style, as the editor's updates do.
  const edit = before ? styleDetachmentChanges(before, applied) : applied
  // Figma overrides only what an edit changes, so setting a layer's own value claims nothing.
  const changed = Object.keys(edit).filter(
    (key) => !before || !isEqual(Reflect.get(edit, key), Reflect.get(before, key))
  )
  g.updateNode(id, edit)
  recordInstanceOverride(g, id, changed)
  if (Object.keys(edit).some((key) => GEOMETRY_FIELDS.has(key))) {
    fitGroupsAround(g, g.getNode(id)?.parentId, hostFitOptions(target, internals))
  }
}
