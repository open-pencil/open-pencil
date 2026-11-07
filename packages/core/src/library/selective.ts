import { SceneGraph } from '@open-pencil/scene-graph'
import {
  layerDependencies,
  remapCopiedReferences,
  variableDependencies
} from '@open-pencil/scene-graph/transfer'

import { diffLibraryManifests } from './diff'
import { copyLibraryTree, libraryDependencyRoots } from './materialize'
import { createLibraryRevision } from './revision'
import { copyVariableTables } from './snapshot'
import type {
  ComponentLibraryRevision,
  LibraryAssetChange,
  LibraryAssetDescriptor,
  PublishLibraryInput
} from './types'

export interface SelectiveLibraryRevisionInput extends Omit<
  PublishLibraryInput,
  'graph' | 'assetIds' | 'libraryId' | 'previousRevisionId'
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

interface CopiedAssets {
  /** The copies of the node assets: components, sets, and styles. */
  nodeIds: string[]
  /** The variables and collections the assets need, by their revision IDs. */
  variables: Set<string>
  collections: Set<string>
}

/**
 * Copies `assets` of `source` into `target`, with the components and styles they use, and the
 * images those paint with. Variables are only gathered: which revision each collection comes from
 * is decided once every asset is in.
 */
function copyAssets(
  target: SceneGraph,
  source: ComponentLibraryRevision,
  assets: LibraryAssetDescriptor[],
  pageId: string
): CopiedAssets {
  const nodeAssets = assets.filter((asset) => asset.type !== 'VARIABLE_COLLECTION')
  const mappedIds = new Map<string, string>()
  const roots = new Map(
    nodeAssets.flatMap((asset) =>
      libraryDependencyRoots(source, asset).map((root) => [root.id, root] as const)
    )
  )
  for (const root of roots.values())
    copyLibraryTree(source.graph, target, root.id, pageId, mappedIds)
  const dependencies = layerDependencies(
    source.graph,
    [...mappedIds.keys()].flatMap((id) => source.graph.getNode(id) ?? [])
  )
  // A style the target already holds, as a republished one is, keeps that version: layers name
  // styles by ID, so a second copy would leave which one they use to chance.
  const held = new Set(
    [...target.getAllNodes()].flatMap((node) =>
      node.sharedStyleType !== null && node.source.id ? [node.source.id] : []
    )
  )
  for (const style of dependencies.styles)
    if (!style.source.id || !held.has(style.source.id))
      copyLibraryTree(source.graph, target, style.id, pageId, mappedIds)
  remapCopiedReferences(target, mappedIds)
  for (const hash of dependencies.images) {
    const bytes = source.graph.images.get(hash)
    if (bytes) target.images.set(hash, new Uint8Array(bytes))
  }
  const collections = assets.flatMap((asset) =>
    asset.type === 'VARIABLE_COLLECTION' ? [asset.sourceId] : []
  )
  const published = variableDependencies(
    source.graph,
    collections.flatMap((id) => source.graph.variableCollections.get(id)?.variableIds ?? [])
  )
  return {
    nodeIds: nodeAssets.flatMap((asset) => mappedIds.get(asset.sourceId) ?? []),
    variables: new Set([...dependencies.variables, ...published.variables]),
    collections: new Set([...dependencies.collections, ...published.collections, ...collections])
  }
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
  const selected = copyAssets(graph, current, currentAssets, page.id)
  const retained = copyAssets(graph, input.previous, retainedAssets, page.id)
  // A collection whose change is not published stays as the previous revision has it.
  const retainedCollections = new Set(
    retainedAssets.flatMap((asset) =>
      asset.type === 'VARIABLE_COLLECTION' ? [asset.sourceId] : []
    )
  )
  copyVariableTables(
    graph,
    new Set([...selected.variables, ...retained.variables]),
    new Set([...selected.collections, ...retained.collections]),
    (id) =>
      retainedCollections.has(id)
        ? [input.previous.graph, current.graph]
        : [current.graph, input.previous.graph]
  )
  return createLibraryRevision({
    libraryId: input.previous.manifest.libraryId,
    name: input.name,
    graph,
    assetIds: [
      ...selected.nodeIds,
      ...retained.nodeIds,
      ...[...currentAssets, ...retainedAssets].flatMap((asset) =>
        asset.type === 'VARIABLE_COLLECTION' ? [asset.sourceId] : []
      )
    ],
    keepLayerIdentities: true,
    previousRevisionId: input.previous.manifest.revisionId,
    description: input.description,
    publishedAt: input.publishedAt,
    renderThumbnail: input.renderThumbnail
  })
}
