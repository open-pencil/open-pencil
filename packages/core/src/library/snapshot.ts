import { cloneNodeProps, SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import { contentHash } from './hash'
import { assertLibraryAssetKey } from './identity'
import type { LibraryAssetDescriptor, PortableLibrarySnapshot } from './types'

const VOLATILE_NODE_FIELDS = new Set([
  'id',
  'parentId',
  'childIds',
  'source',
  'instanceOverrides',
  'componentPropertyAssignments',
  'textPicture',
  'derivedTextGlyphs',
  'derivedLayout',
  'librarySource',
  'pluginData'
])

function assetKey(node: SceneNode): string {
  const key = node.componentKey ?? node.sourceLibraryKey ?? node.publishId ?? node.source.id
  if (!key) throw new Error(`Component ${node.name} has no stable library asset key`)
  assertLibraryAssetKey(key)
  return key
}

function collectNodeClosure(graph: SceneGraph, rootIds: string[]): Set<string> {
  const ids = new Set<string>()
  const pending = [...rootIds]
  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || ids.has(id)) continue
    const node = graph.getNode(id)
    if (!node) continue
    ids.add(id)
    pending.push(...node.childIds)
    if (node.componentId) pending.push(node.componentId)
  }
  return ids
}

function addSnapshotNode(
  source: SceneGraph,
  target: SceneGraph,
  sourceId: string,
  targetParentId: string,
  mappedIds: Map<string, string>
): void {
  const node = source.getNode(sourceId)
  if (!node) return
  const created = target.createNode(
    node.type,
    targetParentId,
    cloneNodeProps(node, node.componentId)
  )
  mappedIds.set(sourceId, created.id)
  for (const childId of node.childIds)
    addSnapshotNode(source, target, childId, created.id, mappedIds)
}

function remapSnapshotReferences(graph: SceneGraph, mappedIds: Map<string, string>): void {
  for (const [sourceId, targetId] of mappedIds) {
    const sourceTarget = graph.getNode(targetId)
    if (!sourceTarget) continue
    const componentId = sourceTarget.componentId
    if (componentId && mappedIds.has(componentId)) {
      graph.updateNode(targetId, { componentId: mappedIds.get(componentId) ?? null })
    }
    if (sourceId === targetId) throw new Error('Snapshot IDs must be remapped')
  }
}

export function extractLibrarySnapshot(
  source: SceneGraph,
  assetNodeIds?: string[]
): PortableLibrarySnapshot {
  const roots = (assetNodeIds ?? [...source.getAllNodes()].map((node) => node.id))
    .map((id) => source.getNode(id))
    .filter(
      (node): node is SceneNode => node?.type === 'COMPONENT' || node?.type === 'COMPONENT_SET'
    )
    .filter((node) => node.parentId && source.getNode(node.parentId)?.type !== 'COMPONENT_SET')
  const closure = collectNodeClosure(
    source,
    roots.map((node) => node.id)
  )
  const snapshot = new SceneGraph()
  const page = snapshot.getPages()[0]
  page.name = 'Library definitions'
  page.internalOnly = true
  const mappedIds = new Map<string, string>()
  const sourceComponentIds = new Map<string, string | null>()
  const closureRoots = [...closure]
    .map((id) => source.getNode(id))
    .filter((node): node is SceneNode =>
      Boolean(node && (!node.parentId || !closure.has(node.parentId)))
    )
  for (const root of closureRoots) addSnapshotNode(source, snapshot, root.id, page.id, mappedIds)
  for (const sourceId of mappedIds.keys()) {
    sourceComponentIds.set(sourceId, source.getNode(sourceId)?.componentId ?? null)
  }
  for (const [sourceId, targetId] of mappedIds) {
    const componentId = sourceComponentIds.get(sourceId)
    if (componentId) snapshot.updateNode(targetId, { componentId })
  }
  remapSnapshotReferences(snapshot, mappedIds)

  for (const imageHash of new Set(
    [...closure].flatMap((id) => {
      const node = source.getNode(id)
      return node
        ? node.fills.flatMap((paint) =>
            paint.type === 'IMAGE' && paint.imageHash ? [paint.imageHash] : []
          )
        : []
    })
  )) {
    const image = source.images.get(imageHash)
    if (image) snapshot.images.set(imageHash, new Uint8Array(image))
  }
  return {
    graph: snapshot,
    assetRoots: roots.flatMap((root) => {
      const id = mappedIds.get(root.id)
      const mapped = id ? snapshot.getNode(id) : undefined
      return mapped ? [mapped] : []
    })
  }
}

function normalizedLibraryField(key: string, value: unknown): unknown {
  if (key === 'lineHeight' && (value === null || value === 17)) return null
  if (
    key === 'fontFeatures' &&
    Array.isArray(value) &&
    (value.length === 0 ||
      JSON.stringify(value) ===
        JSON.stringify([
          { tag: 'LIGA', enabled: true },
          { tag: 'CALT', enabled: true }
        ]))
  ) {
    return []
  }
  if (key === 'fills' && Array.isArray(value)) {
    return value.map((paint) => {
      if (!paint || typeof paint !== 'object' || Array.isArray(paint)) return paint
      return Object.fromEntries(
        Object.entries(paint).filter(
          ([field, fieldValue]) => !(field === 'blendMode' && fieldValue === 'NORMAL')
        )
      )
    })
  }
  return value
}

export function canonicalLibraryNode(
  graph: SceneGraph,
  node: SceneNode,
  dependencyStack = new Set<string>()
): unknown {
  const visualFields = Object.fromEntries(
    Object.entries(node)
      .filter(
        ([key]) =>
          !VOLATILE_NODE_FIELDS.has(key) &&
          key !== 'componentId' &&
          key !== 'instanceIndex' &&
          key !== 'name' &&
          key !== 'symbolDescription'
      )
      .map(([key, value]) => [key, normalizedLibraryField(key, value)])
  )
  const component = node.componentId ? graph.getNode(node.componentId) : undefined
  const dependencyKey =
    component?.type === 'COMPONENT' || component?.type === 'COMPONENT_SET'
      ? assetKey(component)
      : null
  const dependency =
    component && dependencyKey && !dependencyStack.has(component.id)
      ? canonicalLibraryNode(graph, component, new Set([...dependencyStack, component.id]))
      : null
  return {
    ...visualFields,
    componentKey: dependencyKey,
    componentDependency: dependency,
    children: node.childIds.flatMap((id) => {
      const child = graph.getNode(id)
      return child ? [canonicalLibraryNode(graph, child, dependencyStack)] : []
    })
  }
}

export async function describeSnapshotAssets(
  snapshot: PortableLibrarySnapshot
): Promise<LibraryAssetDescriptor[]> {
  return Promise.all(
    snapshot.assetRoots.map(async (node) => ({
      key: assetKey(node),
      type: node.type === 'COMPONENT_SET' ? 'COMPONENT_SET' : 'COMPONENT',
      name: node.name,
      description: node.symbolDescription,
      sourceNodeId: node.id,
      contentHash: await contentHash(canonicalLibraryNode(snapshot.graph, node, new Set([node.id])))
    }))
  )
}
