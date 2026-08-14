import type { ComponentLibraryManifest, LibraryAssetChange } from './types'

export function diffLibraryManifests(
  previous: ComponentLibraryManifest,
  next: ComponentLibraryManifest
): LibraryAssetChange[] {
  if (previous.libraryId !== next.libraryId) {
    throw new Error('Cannot diff manifests from different libraries')
  }
  const previousByKey = new Map(previous.assets.map((asset) => [asset.key, asset]))
  const nextByKey = new Map(next.assets.map((asset) => [asset.key, asset]))
  const changes: LibraryAssetChange[] = []

  for (const asset of next.assets) {
    const oldAsset = previousByKey.get(asset.key)
    if (!oldAsset) {
      changes.push({ kind: 'added', asset })
    } else if (oldAsset.contentHash !== asset.contentHash) {
      changes.push({ kind: 'modified', previous: oldAsset, asset })
    } else if (oldAsset.name !== asset.name || oldAsset.description !== asset.description) {
      changes.push({ kind: 'renamed', previous: oldAsset, asset })
    }
  }
  for (const asset of previous.assets) {
    if (!nextByKey.has(asset.key)) changes.push({ kind: 'removed', asset })
  }
  return changes
}
