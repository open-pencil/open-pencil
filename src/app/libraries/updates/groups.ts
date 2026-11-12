import {
  libraryIdentityForComponent,
  type ComponentLibraryRevision,
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

/** Reads a library revision, or the latest one when `revisionId` is left out. */
export type LibraryRevisionReader = (
  libraryId: string,
  revisionId?: string
) => Promise<ComponentLibraryRevision>

function pageIdForNode(editor: EditorStore, nodeId: string): string | null {
  let node = editor.graph.getNode(nodeId)
  while (node?.parentId) {
    const parent = editor.graph.getNode(node.parentId)
    if (parent?.type === 'CANVAS') return parent.id
    node = parent
  }
  return null
}

export function scopeLibraryUpdateGroups(
  editor: EditorStore,
  groups: LibraryAssetUpdateGroup[],
  allPages: boolean
): LibraryAssetUpdateGroup[] {
  if (allPages) return groups
  return groups.flatMap((group) => {
    const instanceIds = group.instanceIds.filter(
      (instanceId) => pageIdForNode(editor, instanceId) === editor.state.currentPageId
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
  getRevision: LibraryRevisionReader
): Promise<LibraryAssetUpdateGroup[]> {
  const groups: LibraryAssetUpdateGroup[] = []
  for (const summary of summaries) {
    const latest = await getRevision(summary.libraryId, summary.latestRevisionId)
    const assets = new Map(latest.manifest.assets.map((asset) => [asset.key, asset]))
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
        const previous = await getRevision(summary.libraryId, identity.revisionId)
        previousAssets = new Map(
          previous.manifest.assets.map((asset) => [asset.key, asset.contentHash])
        )
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
