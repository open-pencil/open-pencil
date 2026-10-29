import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { isValidLibraryAssetKey } from './identity'

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

function publishedRoots(graph: SceneGraph, assetNodeIds?: string[]): SceneNode[] {
  if (!assetNodeIds) return publishableLibraryRoots(graph)
  const selected = new Set(assetNodeIds)
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
  assetNodeIds?: string[]
): AssetKeyAssignment[] {
  const roots = publishedRoots(graph, assetNodeIds)
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
