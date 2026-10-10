import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph } from '../index'
import {
  createInstanceOverrideState,
  forEachInstanceOverride,
  setInstanceOverride,
  type InstanceOverrideState,
  type OverridePath
} from '../instance-overrides'
import type { SceneNode } from '../types'
import { overrideTarget } from './addressing'
import { INSTANCE_SYNC_FIELDS } from './fields'
import { instanceLayerId, instanceScope, overridePathKey, parseInstanceLayerId } from './layer-ids'
import { layerOverrideValue } from './override-values'
import { walkInstanceSources } from './source-walk'
import { sourceInTargetCoordinates } from './sync'

export interface AdoptedInstance {
  readonly node: SceneNode
  readonly prefix: OverridePath
}

function startsWith(path: OverridePath, prefix: OverridePath): boolean {
  return prefix.every((segment, index) => path[index] === segment)
}

/**
 * Overrides a nested instance's contents need to keep looking as they do: what its owner
 * recorded under it, and every field in which they differ from its component, such as what the
 * component that held it overrode.
 */
export function ownOverrides(
  graph: SceneGraph,
  adopted: AdoptedInstance,
  ownerOverrides: InstanceOverrideState
): InstanceOverrideState {
  const state = createInstanceOverrideState()
  forEachInstanceOverride(ownerOverrides, (path, field, value) => {
    if (!startsWith(path, adopted.prefix)) return
    setInstanceOverride(state, path.slice(adopted.prefix.length), field, value)
  })
  const { node } = adopted
  // Its copies are addressed from wherever it sits now: its own id, or its original owner.
  const { prefix } = instanceScope(node)
  walkInstanceSources(graph, node, (source, target) => {
    const address = parseInstanceLayerId(target.id)
    if (!address) return false
    const path = address.path.slice(prefix.length)
    const scaled = sourceInTargetCoordinates(source, target.componentScale)
    for (const field of INSTANCE_SYNC_FIELDS)
      if (!isEqual(target[field], scaled[field]))
        setInstanceOverride(state, path, field, layerOverrideValue(target, field))
    return true
  })
  return state
}

/**
 * Turn the copies below `root` into layers of their own, as detaching an instance does. They get
 * fresh ids; nested instances among them become instances of their own, holding the overrides
 * recorded for their contents, whose copies are renamed under them. Returns the new id of every
 * renamed layer.
 */
export function adoptCopies(graph: SceneGraph, root: SceneNode): ReadonlyMap<string, string> {
  const renames = new Map<string, string>()
  const adopted: AdoptedInstance[] = []
  const visit = (node: SceneNode, scope: { owner: string; prefix: OverridePath } | null) => {
    const address = parseInstanceLayerId(node.id)
    // An instance of the root's own, such as one placed in its slot, owns its copies already.
    if (!address && node.type === 'INSTANCE') return
    let next = scope
    if (address && scope) {
      renames.set(node.id, instanceLayerId(scope.owner, address.path.slice(scope.prefix.length)))
    } else if (address) {
      const id = graph.nextNodeId()
      renames.set(node.id, id)
      if (node.type === 'INSTANCE') {
        adopted.push({ node, prefix: address.path })
        next = { owner: id, prefix: address.path }
      }
    }
    for (const child of graph.getChildren(node.id)) visit(child, next)
  }
  for (const child of graph.getChildren(root.id)) visit(child, null)
  if (renames.size === 0) return renames

  const addresses = [...renames.keys()].flatMap((id) => parseInstanceLayerId(id) ?? [])
  // The instance that records overrides for the root's layers: the root itself, or the
  // outermost instance a nested copy sits in.
  const owner = overrideTarget(graph, root)?.owner
  const adoptedPaths = new Set(addresses.map((address) => overridePathKey(address.path)))
  graph.renameNodes(renames)
  if (!owner) return renames

  for (const instance of adopted)
    graph.updateNode(instance.node.id, {
      instanceOverrides: ownOverrides(graph, instance, owner.instanceOverrides)
    })
  // The owner no longer overrides layers that are now its own or another instance's.
  const remaining = createInstanceOverrideState()
  forEachInstanceOverride(owner.instanceOverrides, (path, field, value) => {
    const inside = adopted.some((instance) => startsWith(path, instance.prefix))
    if (path.length === 0 || (!adoptedPaths.has(overridePathKey(path)) && !inside))
      setInstanceOverride(remaining, path, field, value)
  })
  graph.updateNode(owner.id, { instanceOverrides: remaining })
  return renames
}
