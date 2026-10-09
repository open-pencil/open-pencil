import type { DerivedSymbolOverride } from '#fig/instance-overrides/types'

import type { GUID } from '@open-pencil/kiwi/fig/codec'
import { parseInstanceLayerId, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

type ResolveGuid = (id: string) => GUID | undefined

/**
 * The `guidPath` addressing `target` from `owner`: the owner's component for the owner itself,
 * the component layers a copy's id names otherwise. Layers that are not the owner's copies,
 * such as slot content it holds, have none.
 */
export function instanceExportAddress(
  owner: SceneNode,
  target: SceneNode,
  resolveGuid: ResolveGuid
): GUID[] | undefined {
  if (target.id === owner.id) {
    const guid = owner.componentId ? resolveGuid(owner.componentId) : undefined
    return guid ? [guid] : undefined
  }
  const address = parseInstanceLayerId(target.id)
  if (address?.owner !== owner.id) return undefined
  const path: GUID[] = []
  for (const segment of address.path) {
    const guid = resolveGuid(segment)
    if (!guid) return undefined
    path.push(guid)
  }
  return path
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
    for (const child of graph.getChildren(node.id)) {
      // Slot content the instance owns is written as its own records, not as derived data.
      if (parseInstanceLayerId(child.id)?.owner !== owner.id) continue
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
