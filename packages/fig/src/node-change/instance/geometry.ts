import type { DerivedSymbolOverride } from '#fig/instance-overrides/types'

import type { GUID } from '@open-pencil/kiwi/fig/codec'
import {
  forEachInstanceOverride,
  instanceLayerId,
  instanceScope,
  ownsSlotContent,
  parseInstanceLayerId,
  type InstanceOverrideField,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

type ResolveGuid = (id: string) => GUID | undefined

/**
 * The layer path of `target` inside `instance`, which a nested copy shares with the outermost
 * instance that names its layers. Layers that are not the instance's copies have none.
 */
function pathInInstance(instance: SceneNode, target: SceneNode): readonly string[] | undefined {
  const address = parseInstanceLayerId(target.id)
  const scope = instanceScope(instance)
  if (address?.owner !== scope.owner || address.path.length <= scope.prefix.length) return undefined
  if (!scope.prefix.every((segment, index) => address.path[index] === segment)) return undefined
  return address.path.slice(scope.prefix.length)
}

/**
 * The `guidPath` addressing `target` from `instance`: the instance's component for the instance
 * itself, the component layers a copy's id names below it otherwise. Layers that are not its
 * copies, such as slot content it holds, have none.
 */
export function instanceExportAddress(
  instance: SceneNode,
  target: SceneNode,
  resolveGuid: ResolveGuid
): GUID[] | undefined {
  if (target.id === instance.id) {
    const guid = instance.componentId ? resolveGuid(instance.componentId) : undefined
    return guid ? [guid] : undefined
  }
  const segments = pathInInstance(instance, target)
  if (!segments) return undefined
  const path: GUID[] = []
  for (const segment of segments) {
    const guid = resolveGuid(segment)
    if (!guid) return undefined
    path.push(guid)
  }
  return path
}

/**
 * Whether `target` is content of a slot an instance at or inside `instance` owns. Such content is
 * written as records of its own, so the instance claims nothing for it.
 */
function inOwnedSlot(graph: SceneGraph, instance: SceneNode, target: SceneNode): boolean {
  for (let id = target.parentId; id && id !== instance.id;) {
    const ancestor = graph.getNode(id)
    if (!ancestor) return false
    if (ownsSlotContent(graph, ancestor)) return true
    id = ancestor.parentId
  }
  return false
}

/**
 * Every override `instance` declares, with the layer it applies to. An instance whose layers
 * are named after an outer one, such as one in slot content it owns, takes what that one
 * recorded below it.
 */
export function forEachExportedOverride(
  graph: SceneGraph,
  instance: SceneNode,
  callback: (target: SceneNode, field: InstanceOverrideField, value: unknown) => void
): void {
  const scope = instanceScope(instance)
  const owner = graph.getNode(scope.owner)
  if (!owner) return
  forEachInstanceOverride(owner.instanceOverrides, (path, field, value) => {
    if (!scope.prefix.every((segment, index) => path[index] === segment)) return
    const target =
      path.length === scope.prefix.length
        ? instance
        : graph.getNode(instanceLayerId(scope.owner, path))
    if (target && !inOwnedSlot(graph, instance, target)) callback(target, field, value)
  })
}

/** Derived geometry is a snapshot, not an authored size or position claim. */
export function snapshotInstanceGeometry(
  graph: SceneGraph,
  owner: SceneNode,
  resolveGuid: ResolveGuid,
  retained: DerivedSymbolOverride[],
  geometry: (node: SceneNode) => Pick<DerivedSymbolOverride, 'size' | 'transform'>
): DerivedSymbolOverride[] {
  const key = (path: GUID[]) => path.map((guid) => `${guid.sessionID}:${guid.localID}`).join('/')
  const entries = new Map<string, DerivedSymbolOverride>()
  const unaddressed: DerivedSymbolOverride[] = []
  for (const entry of retained) {
    if (!entry.guidPath?.guids?.length) {
      unaddressed.push(entry)
      continue
    }
    const id = key(entry.guidPath.guids)
    entries.set(id, { ...entries.get(id), ...entry })
  }
  const visit = (node: SceneNode): void => {
    // Slot content the instance owns is written as its own records, not as derived data.
    if (node.id !== owner.id && ownsSlotContent(graph, node)) return
    for (const child of graph.getChildren(node.id)) {
      if (!pathInInstance(owner, child)) continue
      const path = instanceExportAddress(owner, child, resolveGuid)
      if (!path)
        throw new Error(`Missing instance geometry address for ${child.id} under ${owner.id}`)
      const id = key(path)
      entries.set(id, { ...entries.get(id), guidPath: { guids: path }, ...geometry(child) })
      visit(child)
    }
  }
  visit(owner)
  return [...unaddressed, ...entries.values()]
}
