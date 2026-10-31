import type { LibraryAssetSource, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'

import { remapCopiedReferences } from './copied-references'
import { findLibraryDefinition } from './definitions'
import { assertLibraryAssetKey, assertLibraryId, libraryAssetIdentityKey } from './identity'
import type { ComponentLibraryRevision, LibraryAssetDescriptor } from './types'
import { assetComponent } from './variants'

const INTERNAL_LIBRARY_PAGE_NAME = 'OpenPencil library definitions'

export interface MaterializedLibraryAsset {
  componentId: string
  componentSetId: string | null
  pageId: string
  created: boolean
}

export function getInternalLibraryPage(graph: SceneGraph): SceneNode {
  const existing = graph
    .getPages(true)
    .find((page) => page.internalOnly && page.name === INTERNAL_LIBRARY_PAGE_NAME)
  if (existing) return existing
  const page = graph.addPage(INTERNAL_LIBRARY_PAGE_NAME)
  graph.updateNode(page.id, { internalOnly: true, visible: false, locked: true })
  return graph.getNode(page.id) ?? page
}

export function libraryDependencyRoots(
  revision: ComponentLibraryRevision,
  descriptor: LibraryAssetDescriptor
): SceneNode[] {
  const root = revision.graph.getNode(descriptor.sourceNodeId)
  if (!root) throw new Error(`Library asset source is missing: ${descriptor.key}`)
  const roots = new Map([[root.id, root]])
  const visited = new Set<string>()
  const pending = [root.id]
  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || visited.has(id)) continue
    visited.add(id)
    const node = revision.graph.getNode(id)
    if (!node) continue
    pending.push(...node.childIds)
    if (!node.componentId) continue
    const component = revision.graph.getNode(node.componentId)
    if (!component) continue
    let definitionRoot = component
    const parent = component.parentId ? revision.graph.getNode(component.parentId) : undefined
    if (parent?.type === 'COMPONENT_SET') definitionRoot = parent
    roots.set(definitionRoot.id, definitionRoot)
    pending.push(definitionRoot.id)
  }
  return [...roots.values()]
}

export function copyLibraryTree(
  source: SceneGraph,
  target: SceneGraph,
  sourceId: string,
  parentId: string,
  mappedIds: Map<string, string>
): void {
  if (mappedIds.has(sourceId)) return
  const node = source.getNode(sourceId)
  if (!node) return
  const created = target.createNode(node.type, parentId, cloneNodeProps(node, node.componentId))
  mappedIds.set(sourceId, created.id)
  for (const childId of node.childIds)
    copyLibraryTree(source, target, childId, created.id, mappedIds)
}

/**
 * The library identity a copy of the revision layer `sourceId` carries as a definition: its
 * asset's, or, for a component other assets use, the component's own key.
 */
export function libraryDefinitionSource(
  revision: ComponentLibraryRevision,
  sourceId: string
): LibraryAssetSource | null {
  const descriptor = revision.manifest.assets.find((asset) => asset.sourceNodeId === sourceId)
  const source = revision.graph.getNode(sourceId)
  const assetKey =
    descriptor?.key ??
    (source?.type === 'COMPONENT' || source?.type === 'COMPONENT_SET'
      ? (source.componentKey ?? source.sourceLibraryKey ?? source.publishId)
      : null)
  if (!assetKey) return null
  return {
    identity: {
      libraryId: revision.manifest.libraryId,
      assetKey,
      revisionId: revision.manifest.revisionId
    },
    sourceNodeId: sourceId,
    readOnly: true
  }
}

function markDefinitions(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  mappedIds: Map<string, string>
): void {
  remapCopiedReferences(graph, mappedIds)
  for (const [sourceId, targetId] of mappedIds) {
    const target = graph.getNode(targetId)
    if (!target) continue
    graph.updateNode(targetId, {
      locked: true,
      librarySource: libraryDefinitionSource(revision, sourceId) ?? target.librarySource
    })
  }
}

export function copyImages(
  source: SceneGraph,
  target: SceneGraph,
  mappedIds: Map<string, string>
): void {
  const hashes = new Set<string>()
  for (const sourceId of mappedIds.keys()) {
    const node = source.getNode(sourceId)
    const fills = [
      ...(node?.fills ?? []),
      ...(node?.fillGeometry.flatMap((geometry) => geometry.fills ?? []) ?? [])
    ]
    for (const fill of fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) hashes.add(fill.imageHash)
    }
  }
  for (const hash of hashes) {
    const image = source.images.get(hash)
    if (image) target.images.set(hash, new Uint8Array(image))
  }
}

export function materializeLibraryAsset(
  consumer: SceneGraph,
  revision: ComponentLibraryRevision,
  assetKey: string
): MaterializedLibraryAsset {
  const { libraryId, revisionId } = revision.manifest
  assertLibraryId(libraryId)
  assertLibraryAssetKey(assetKey)
  consumer.enabledLibraries.set(libraryId, { libraryId, revisionId, enabled: true })
  const existing = findLibraryDefinition(consumer, libraryId, assetKey, revisionId)
  if (existing) {
    const component = assetComponent(consumer, existing)?.component
    if (!component) throw new Error(`Materialized asset has no component: ${assetKey}`)
    return {
      componentId: component.id,
      componentSetId: existing.type === 'COMPONENT_SET' ? existing.id : null,
      pageId: existing.parentId ?? consumer.rootId,
      created: false
    }
  }

  const descriptor = revision.manifest.assets.find((asset) => asset.key === assetKey)
  if (!descriptor)
    throw new Error(`Library asset not found: ${libraryAssetIdentityKey(libraryId, assetKey)}`)
  const page = getInternalLibraryPage(consumer)
  const mappedIds = new Map<string, string>()
  for (const root of libraryDependencyRoots(revision, descriptor)) {
    copyLibraryTree(revision.graph, consumer, root.id, page.id, mappedIds)
  }
  markDefinitions(consumer, revision, mappedIds)
  copyImages(revision.graph, consumer, mappedIds)

  const rootId = mappedIds.get(descriptor.sourceNodeId)
  const root = rootId ? consumer.getNode(rootId) : undefined
  if (!root) throw new Error(`Failed to materialize library asset: ${assetKey}`)
  const component = assetComponent(consumer, root)?.component
  if (!component) throw new Error(`Library asset has no component: ${assetKey}`)
  return {
    componentId: component.id,
    componentSetId: root.type === 'COMPONENT_SET' ? root.id : null,
    pageId: page.id,
    created: true
  }
}
