import {
  libraryIdentityForComponent,
  type ComponentLibraryManifest,
  type LibrarySummary
} from '@open-pencil/core/library'

import type { EditorStore } from '@/app/editor/session'

export interface LibraryAssetUpdateGroup {
  libraryId: string
  assetKey: string
  name: string
  instanceIds: string[]
  currentPageCount: number
  allPagesCount: number
}

/**
 * Reads a revision's manifest, or the latest one's when `revisionId` is left out. `null` means
 * the revision is unavailable right now — still syncing or parked failed — so its library
 * contributes no update groups this pass.
 */
export type LibraryManifestReader = (
  libraryId: string,
  revisionId?: string
) => Promise<ComponentLibraryManifest | null>

export function scopeLibraryUpdateGroups(
  editor: EditorStore,
  groups: LibraryAssetUpdateGroup[],
  allPages: boolean
): LibraryAssetUpdateGroup[] {
  if (allPages) return groups
  return groups.flatMap((group) => {
    const instanceIds = group.instanceIds.filter(
      (instanceId) => editor.graph.pageOf(instanceId) === editor.state.currentPageId
    )
    return instanceIds.length > 0
      ? [{ ...group, instanceIds, currentPageCount: instanceIds.length }]
      : []
  })
}

/**
 * Groups the document's instances of each library asset whose content changed between the
 * revision the instance comes from and the library's latest one.
 */
export async function collectLibraryUpdateGroups(
  editor: EditorStore,
  summaries: readonly LibrarySummary[],
  getManifest: LibraryManifestReader
): Promise<LibraryAssetUpdateGroup[]> {
  const groups: LibraryAssetUpdateGroup[] = []
  for (const summary of summaries) {
    const latest = await getManifest(summary.libraryId, summary.latestRevisionId)
    if (!latest) continue
    const assets = new Map(latest.assets.map((asset) => [asset.key, asset]))
    const previousAssetsByRevision = new Map<string, Map<string, string>>()
    const instancesByAsset = new Map<string, string[]>()
    for (const node of editor.graph.getAllNodes()) {
      if (node.type !== 'INSTANCE' || !node.componentId) continue
      const identity = libraryIdentityForComponent(editor.graph, node.componentId)
      if (identity?.libraryId !== summary.libraryId) continue
      if (identity.revisionId === summary.latestRevisionId) continue
      const { assetKey } = identity
      const latestAsset = assets.get(assetKey)
      if (!latestAsset) continue
      let previousAssets = previousAssetsByRevision.get(identity.revisionId)
      if (!previousAssets) {
        const previous = await getManifest(summary.libraryId, identity.revisionId)
        if (!previous) continue
        previousAssets = new Map(previous.assets.map((asset) => [asset.key, asset.contentHash]))
        previousAssetsByRevision.set(identity.revisionId, previousAssets)
      }
      if (previousAssets.get(assetKey) === latestAsset.contentHash) continue
      const ids = instancesByAsset.get(assetKey) ?? []
      ids.push(node.id)
      instancesByAsset.set(assetKey, ids)
    }
    for (const [assetKey, instanceIds] of instancesByAsset) {
      const asset = assets.get(assetKey)
      if (!asset) continue
      groups.push({
        libraryId: summary.libraryId,
        assetKey,
        name: asset.name,
        instanceIds,
        currentPageCount: instanceIds.length,
        allPagesCount: instanceIds.length
      })
    }
  }
  return groups
}
