import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { isValidLibraryAssetKey } from './identity'

export interface AssetKeyAssignment {
  nodeId: string
  assetKey: string
  existing: boolean
}

function normalizeAssetKey(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

export function ensureLibraryAssetKeys(
  graph: SceneGraph,
  assetNodeIds?: string[]
): AssetKeyAssignment[] {
  const roots = publishedRoots(graph, assetNodeIds)
  const used = new Set(
    [...graph.getAllNodes()].flatMap((node) =>
      node.componentKey && isValidLibraryAssetKey(node.componentKey) ? [node.componentKey] : []
    )
  )
  return roots.map((node) => {
    if (node.componentKey && isValidLibraryAssetKey(node.componentKey)) {
      return { nodeId: node.id, assetKey: node.componentKey, existing: true }
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
