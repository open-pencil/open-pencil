import { SceneGraph } from '@open-pencil/scene-graph'

import { diffLibraryManifests } from './diff'
import { copyLibraryTree, libraryDependencyRoots } from './materialize'
import { createLibraryRevision } from './revision'
import type {
  ComponentLibraryRevision,
  LibraryAssetChange,
  LibraryAssetDescriptor,
  PublishLibraryInput
} from './types'

export interface SelectiveLibraryRevisionInput extends Omit<
  PublishLibraryInput,
  'graph' | 'assetNodeIds' | 'libraryId' | 'previousRevisionId'
> {
  previous: ComponentLibraryRevision
  sourceGraph: SceneGraph
  selectedAssetKeys: ReadonlySet<string>
}

export async function discoverPublishableLibraryChanges(
  previous: ComponentLibraryRevision,
  sourceGraph: SceneGraph
): Promise<{ current: ComponentLibraryRevision; changes: LibraryAssetChange[] }> {
  const current = await createLibraryRevision({
    libraryId: previous.manifest.libraryId,
    name: previous.manifest.name,
    graph: sourceGraph,
    previousRevisionId: previous.manifest.revisionId,
    publishedAt: previous.manifest.publishedAt
  })
  return { current, changes: diffLibraryManifests(previous.manifest, current.manifest) }
}

function copyAssets(
  target: SceneGraph,
  source: ComponentLibraryRevision,
  assets: LibraryAssetDescriptor[],
  pageId: string,
  mappedIds = new Map<string, string>()
): string[] {
  const roots = new Map(
    assets.flatMap((asset) =>
      libraryDependencyRoots(source, asset).map((root) => [root.id, root] as const)
    )
  )
  for (const root of roots.values())
    copyLibraryTree(source.graph, target, root.id, pageId, mappedIds)
  for (const [sourceId, targetId] of mappedIds) {
    const sourceNode = source.graph.getNode(sourceId)
    const componentId = sourceNode?.componentId ? mappedIds.get(sourceNode.componentId) : null
    if (componentId) target.updateNode(targetId, { componentId })
  }
  for (const [hash, bytes] of source.graph.images) target.images.set(hash, new Uint8Array(bytes))
  return assets.flatMap((asset) => {
    const id = mappedIds.get(asset.sourceNodeId)
    return id ? [id] : []
  })
}

export async function createSelectiveLibraryRevision(
  input: SelectiveLibraryRevisionInput
): Promise<ComponentLibraryRevision> {
  const { current, changes } = await discoverPublishableLibraryChanges(
    input.previous,
    input.sourceGraph
  )
  const selectedChanges = changes.filter((change) => input.selectedAssetKeys.has(change.asset.key))
  if (selectedChanges.length === 0) throw new Error('No library changes selected')

  const selectedKeys = new Set(selectedChanges.map((change) => change.asset.key))
  const removedKeys = new Set(
    selectedChanges.flatMap((change) => (change.kind === 'removed' ? [change.asset.key] : []))
  )
  const currentAssets = current.manifest.assets.filter((asset) => selectedKeys.has(asset.key))
  const retainedAssets = input.previous.manifest.assets.filter(
    (asset) => !selectedKeys.has(asset.key) && !removedKeys.has(asset.key)
  )
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const currentNodeIds = copyAssets(graph, current, currentAssets, page.id)
  const currentKeys = new Set(currentAssets.map((asset) => asset.key))
  const retainedWithoutCurrentDependencies = retainedAssets.filter(
    (asset) => !currentKeys.has(asset.key)
  )
  const assetNodeIds = [
    ...currentNodeIds,
    ...copyAssets(graph, input.previous, retainedWithoutCurrentDependencies, page.id)
  ]
  return createLibraryRevision({
    libraryId: input.previous.manifest.libraryId,
    name: input.name,
    graph,
    assetNodeIds,
    previousRevisionId: input.previous.manifest.revisionId,
    description: input.description,
    publishedAt: input.publishedAt
  })
}
