import {
  isLibraryCollection,
  type SceneGraph,
  type SceneNode,
  type VariableCollection
} from '@open-pencil/scene-graph'
import { collectionAssetKey, styleAssetKey } from '@open-pencil/scene-graph/asset-keys'

import { assertLibraryAssetKey, isValidLibraryAssetKey } from './identity'
import type { LibraryAssetDescriptor, LibraryComponentAssetType } from './types'

export interface AssetKeyAssignment {
  nodeId: string
  assetKey: string
  existing: boolean
}

/** The longest key a name gives, leaving room for the `-N` a namesake's key takes. */
const MAX_NAME_KEY_LENGTH = 240

/** A valid asset key from a component's name: it starts with a letter or digit. */
function normalizeAssetKey(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:/-]+/g, '-')
    .replace(/^[^a-z0-9]+|-+$/g, '')
    .slice(0, MAX_NAME_KEY_LENGTH)
  return normalized || 'component'
}

export function publishableLibraryRoots(
  graph: SceneGraph
): Array<SceneNode & { type: 'COMPONENT' | 'COMPONENT_SET' }> {
  return [...graph.getAllNodes()].filter(
    (node): node is SceneNode & { type: 'COMPONENT' | 'COMPONENT_SET' } => {
      if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
      if (node.librarySource?.readOnly) return false
      const parent = node.parentId ? graph.getNode(node.parentId) : undefined
      return parent?.type !== 'COMPONENT_SET'
    }
  )
}

/** The document's own shared styles; a style a library brought in stays that library's. */
export function publishableLibraryStyles(graph: SceneGraph): SceneNode[] {
  return [...graph.getAllNodes()].filter(
    // A style is known by its source ID, as `getSharedStyles` lists them; layers link it by that.
    (node) => node.sharedStyleType !== null && !!node.source.id && !node.librarySource?.readOnly
  )
}

/** The document's own variable collections; one a library brought in stays that library's. */
export function publishableLibraryCollections(graph: SceneGraph): VariableCollection[] {
  return [...graph.variableCollections.values()].filter(
    (collection) => !isLibraryCollection(collection)
  )
}

function publishedRoots(graph: SceneGraph, assetIds?: string[]): SceneNode[] {
  if (!assetIds) return publishableLibraryRoots(graph)
  const selected = new Set(assetIds)
  return publishableLibraryRoots(graph).filter((node) => selected.has(node.id))
}

/**
 * The asset key a component already publishes under: its own key, or else the library key, publish
 * ID or file ID it was read with — the identity a revision gives the asset.
 */
export function existingAssetKey(node: SceneNode): string | null {
  return node.componentKey ?? node.sourceLibraryKey ?? node.publishId ?? node.source.id
}

/**
 * Gives each published component without an asset key one made from its name, distinct from every
 * key the document already uses; a component keeps the identity it already publishes under.
 */
export function ensureLibraryAssetKeys(
  graph: SceneGraph,
  assetIds?: string[]
): AssetKeyAssignment[] {
  const roots = publishedRoots(graph, assetIds)
  const used = new Set(
    [...graph.getAllNodes()].flatMap((node) => {
      const key =
        node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' ? existingAssetKey(node) : null
      return key && isValidLibraryAssetKey(key) ? [key] : []
    })
  )
  return roots.map((node) => {
    const existing = existingAssetKey(node)
    if (existing && isValidLibraryAssetKey(existing)) {
      return { nodeId: node.id, assetKey: existing, existing: true }
    }
    const base = normalizeAssetKey(node.name)
    let assetKey = base
    let suffix = 2
    while (used.has(assetKey)) assetKey = `${base}-${suffix++}`
    used.add(assetKey)
    graph.updateNode(node.id, { componentKey: assetKey })
    return { nodeId: node.id, assetKey, existing: false }
  })
}

export function duplicateLibraryAssetKeys(graph: SceneGraph): Map<string, string[]> {
  const byKey = new Map<string, string[]>()
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') continue
    if (!node.componentKey) continue
    const ids = byKey.get(node.componentKey) ?? []
    ids.push(node.id)
    byKey.set(node.componentKey, ids)
  }
  return new Map([...byKey].filter(([, ids]) => ids.length > 1))
}

/** The key a component, set, or style publishes under. */
export function libraryAssetKey(node: SceneNode): string {
  if (node.sharedStyleType !== null) return styleAssetKey(node)
  const key = existingAssetKey(node)
  if (!key) throw new Error(`Component ${node.name} has no stable library asset key`)
  assertLibraryAssetKey(key)
  return key
}

/** What a document can publish, as the publish dialog lists it before any revision exists. */
export type PublishableLibraryAsset = Omit<LibraryAssetDescriptor, 'contentHash' | 'thumbnail'>

/**
 * Every component, set, style, and collection the document can publish, under the keys a
 * revision gives them. Components without a key get one first (`ensureLibraryAssetKeys`).
 */
export function publishableLibraryAssets(graph: SceneGraph): PublishableLibraryAsset[] {
  return [
    ...publishableLibraryRoots(graph).map((node) => ({
      key: libraryAssetKey(node),
      type: node.type,
      name: node.name,
      description: node.symbolDescription,
      sourceId: node.id
    })),
    ...publishableLibraryStyles(graph).map((node) => ({
      key: libraryAssetKey(node),
      type: 'STYLE' as const,
      name: node.name,
      description: node.symbolDescription,
      sourceId: node.id
    })),
    ...publishableLibraryCollections(graph).map((collection) => ({
      key: collectionAssetKey(collection),
      type: 'VARIABLE_COLLECTION' as const,
      name: collection.name,
      description: '',
      sourceId: collection.id
    }))
  ]
}

/** An asset a document inserts as instances: a component or a component set. */
export function isLibraryComponentAsset<T extends Pick<LibraryAssetDescriptor, 'type'>>(
  asset: T
): asset is T & { type: LibraryComponentAssetType } {
  return asset.type === 'COMPONENT' || asset.type === 'COMPONENT_SET'
}
