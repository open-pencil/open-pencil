import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import type { AssignmentGroup, StructuralLayer } from '../layers'
import { readOverrideKey, sameGuid, type InterpreterIndex } from '../source-index'
import type { ComponentPropAssignment } from '../types'

type Sources = InterpreterIndex['sources']

/** A component and its override key both address the root of an instance's expansion. */
export function componentKeys(sources: Sources, guid: GUID | undefined): GUID[] {
  if (!guid) return []
  const key = readOverrideKey(sources.get(guidToString(guid))?.overrideKey)
  return key ? [guid, key] : [guid]
}

export interface RootResolution {
  effective: GUID | undefined
  /** Components superseded on the way to `effective`, innermost decision first. */
  replaced: GUID[]
  groups: AssignmentGroup[]
  descendant: StructuralLayer[]
}

/** Components an occurrence would have expanded before outer bindings replaced them. */
function bindingHistory(
  raw: NodeChange,
  effective: GUID | undefined,
  superseded: readonly GUID[]
): GUID[] {
  const original = raw.symbolData?.symbolID
  if (!effective) return []
  return [...(original ? [original] : []), ...superseded].filter(
    (component) => !sameGuid(component, effective)
  )
}

/**
 * Root layers select the effective component and the complete assignment list, in
 * inner-to-outer order so later entries win. Everything else addresses a descendant.
 */
export function resolveRoot(
  sources: Sources,
  raw: NodeChange,
  source: NodeChange,
  superseded: readonly GUID[],
  structural: readonly StructuralLayer[],
  rank: number
): RootResolution {
  let effective = source.symbolData?.symbolID
  const replaced = bindingHistory(raw, effective, superseded)
  const keys = [
    ...componentKeys(sources, raw.symbolData?.symbolID),
    ...componentKeys(sources, effective)
  ]
  const isKey = (guid: GUID): boolean => keys.some((key) => sameGuid(key, guid))
  const groups: AssignmentGroup[] = [
    { assignments: (source.componentPropAssignments ?? []) as ComponentPropAssignment[], rank }
  ]
  const descendant: StructuralLayer[] = []
  const swapRoot = (swap: GUID): void => {
    if (!effective) throw new Error('Swap target is not an instance')
    if (!sameGuid(effective, swap)) replaced.push(effective)
    effective = swap
    // Later layers may address the root through the replacement's identity.
    for (const key of componentKeys(sources, effective)) if (!isKey(key)) keys.push(key)
  }
  for (const layer of structural) {
    const addressesRoot = layer.path.length === 0 || isKey(layer.path[0])
    if (!addressesRoot || layer.path.length > 1) {
      descendant.push(addressesRoot ? { ...layer, path: layer.path.slice(1) } : layer)
      continue
    }
    if (layer.swap) swapRoot(layer.swap)
    if (layer.assignments.length)
      groups.push({ assignments: layer.assignments, rank: layer.owner.rank })
  }
  return { effective, replaced, groups, descendant }
}
