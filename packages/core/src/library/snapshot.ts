import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'
import { standardStyleName } from '@open-pencil/scene-graph/font-style'
import { drawnImageHashes } from '@open-pencil/scene-graph/images'
import { findInstanceAncestor } from '@open-pencil/scene-graph/instances'
import { copiedComponentLayerId } from '@open-pencil/scene-graph/instances/overrides'
import { contentPluginData } from '@open-pencil/scene-graph/plugin-data'
import { ownsSlotContent, slotScope } from '@open-pencil/scene-graph/slots'
import { remapCopiedReferences } from '@open-pencil/scene-graph/transfer'

import { existingAssetKey } from './asset-keys'
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
  // Caches measured from the fonts at hand, which a FIG round trip writes or leaves out by them.
  'derivedTextGlyphs',
  'derivedTextHeight',
  'derivedLayout',
  'librarySource',
  'libraryLayerId'
])

function assetKey(node: SceneNode): string {
  const key = existingAssetKey(node)
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

/** The component layer `node` copies into the instance `owner`, if it is a copy. */
function copiedLayerId(source: SceneGraph, owner: SceneNode, node: SceneNode): string | undefined {
  const scope = node.parentId ? slotScope(source, node.parentId) : undefined
  // Content an instance's slot holds is the instance's own, not a copy of its component.
  if (scope?.kind === 'slot' && ownsSlotContent(source, scope.frame, scope.propertyId))
    return undefined
  // A swapped nested instance names the component it shows; its owner records the layer it copies.
  return copiedComponentLayerId(owner.instanceOverrides, owner.id, node)
}

/**
 * The identity each layer of `source` keeps across revisions: its id in the source document, or,
 * for a layer an instance copies from its component, which a document rebuilds on every load, the
 * identities of the instance and of the component layer it copies. With `keepCarried`, a layer
 * copied from a revision keeps the identity it carries; in any other document an instance copy
 * carries its component's, which is not its own.
 */
function layerIdentities(source: SceneGraph, keepCarried: boolean): (node: SceneNode) => string {
  const known = new Map<string, string>()
  const identify = (node: SceneNode): string => {
    const cached = known.get(node.id)
    if (cached) return cached
    const owner = node.parentId ? findInstanceAncestor(source, node.parentId) : undefined
    const copiedId = owner ? copiedLayerId(source, owner, node) : undefined
    const copied = copiedId ? source.getNode(copiedId) : undefined
    const kept = keepCarried ? node.libraryLayerId : null
    const identity =
      kept ??
      (owner && copied ? `${identify(owner)}/${identify(copied)}` : (node.source.id ?? node.id))
    known.set(node.id, identity)
    return identity
  }
  return identify
}

function addSnapshotNode(
  source: SceneGraph,
  target: SceneGraph,
  sourceId: string,
  targetParentId: string,
  mappedIds: Map<string, string>,
  identify: (node: SceneNode) => string
): void {
  const node = source.getNode(sourceId)
  if (!node) return
  const created = target.createNode(node.type, targetParentId, {
    ...cloneNodeProps(node, node.componentId),
    // A behaviour or other plugin content belongs to the asset; where it came from does not.
    pluginData: contentPluginData(node.pluginData),
    libraryLayerId: identify(node)
  })
  mappedIds.set(sourceId, created.id)
  for (const childId of node.childIds)
    addSnapshotNode(source, target, childId, created.id, mappedIds, identify)
}

export function extractLibrarySnapshot(
  source: SceneGraph,
  assetNodeIds?: string[],
  keepLayerIdentities = false
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
  const closureRoots = [...closure]
    .map((id) => source.getNode(id))
    .filter((node): node is SceneNode =>
      Boolean(node && (!node.parentId || !closure.has(node.parentId)))
    )
  const identify = layerIdentities(source, keepLayerIdentities)
  for (const root of closureRoots)
    addSnapshotNode(source, snapshot, root.id, page.id, mappedIds, identify)
  for (const [sourceId, targetId] of mappedIds)
    if (sourceId === targetId) throw new Error('Snapshot IDs must be remapped')
  remapCopiedReferences(snapshot, mappedIds)

  for (const imageHash of new Set(
    [...closure].flatMap((id) => {
      const node = source.getNode(id)
      return node ? drawnImageHashes(node) : []
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

/** A field as an asset's content compares it. */
function libraryField(node: SceneNode, key: string, value: unknown): unknown {
  // Plugin content such as a behaviour is part of the asset; its bookkeeping is not.
  if (key === 'pluginData') return contentPluginData(node.pluginData)
  if (key === 'fontStyle') return libraryStyleName(node)
  return normalizedLibraryField(key, value)
}

/**
 * The face a text's name names, compared as a name: a file writes the name the text left to its
 * weight and slant, and spells some as Figma's fonts do ("Semi Bold" for "SemiBold").
 */
function libraryStyleName(node: SceneNode): string {
  return (node.fontStyle ?? standardStyleName(node.fontWeight, node.italic))
    .toLowerCase()
    .replace(/\s+/gu, '')
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
      .map(([key, value]) => [key, libraryField(node, key, value)])
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
