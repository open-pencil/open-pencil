import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

/** Exact versioned lookup; ambiguous unversioned keys are rejected. */
export function createResourceResolver(resources: readonly NodeChange[]) {
  const keys = new Map<string, Map<string, string>>()
  for (const resource of resources) {
    if (!resource.guid || typeof resource.key !== 'string') continue
    const versions = keys.get(resource.key) ?? new Map<string, string>()
    const version = typeof resource.version === 'string' ? resource.version : ''
    const id = guidToString(resource.guid)
    if (versions.has(version) && versions.get(version) !== id) {
      throw new Error(`Ambiguous resource ${resource.key} version ${version}`)
    }
    versions.set(version, id)
    keys.set(resource.key, versions)
  }
  return (reference: NodeChange['variableSetID']): string | undefined => {
    if (reference?.guid) return guidToString(reference.guid)
    const asset = reference?.assetRef
    if (!asset) return undefined
    const versions = keys.get(asset.key)
    if (asset.version) return versions?.get(asset.version)
    return versions?.size === 1 ? versions.values().next().value : undefined
  }
}
