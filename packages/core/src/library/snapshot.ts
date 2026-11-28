import { omit, uniqBy } from 'es-toolkit'

import { SceneGraph, type SceneNode, type VariableCollection } from '@open-pencil/scene-graph'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'
import { standardStyleName } from '@open-pencil/scene-graph/font-style'
import { copyImages } from '@open-pencil/scene-graph/images'
import { findInstanceAncestor } from '@open-pencil/scene-graph/instances'
import { copiedComponentLayerId } from '@open-pencil/scene-graph/instances/overrides'
import { contentPluginData } from '@open-pencil/scene-graph/plugin-data'
import { ownsSlotContent, slotScope } from '@open-pencil/scene-graph/slots'
import {
  copyVariableTables,
  layerDependencies,
  remapCopiedReferences,
  variableDependencies
} from '@open-pencil/scene-graph/transfer'

import {
  existingAssetKey,
  libraryAssetKey,
  libraryCollectionAsset,
  libraryLayerAsset,
  publishableLibraryCollections,
  publishableLibraryRoots,
  publishableLibraryStyles
} from './asset-keys'
import { contentHash } from './hash'
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

function collectNodeClosure(graph: SceneGraph, rootIds: string[]): Set<string> {
  const ids = new Set<string>()
  const pending = [...rootIds]
  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || ids.has(id)) continue
    const node = graph.getNode(id)
    if (!node) continue
    ids.add(id)
    for (const childId of node.childIds) pending.push(childId)
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

/**
 * The component set a keyless variant belongs to, when this snapshot would otherwise leave the
 * set behind. A variant is not an asset of its own: instances hash it under the set's key, which
 * they can only do while the variant stays parented to that set.
 */
function omittedVariantSet(
  source: SceneGraph,
  closure: ReadonlySet<string>,
  node: SceneNode
): SceneNode | undefined {
  if (node.type !== 'COMPONENT' || existingAssetKey(node)) return undefined
  const parent = node.parentId ? source.getNode(node.parentId) : undefined
  if (parent?.type !== 'COMPONENT_SET' || closure.has(parent.id)) return undefined
  return parent
}

function addSnapshotNode(
  source: SceneGraph,
  target: SceneGraph,
  sourceId: string,
  targetParentId: string,
  mappedIds: Map<string, string>,
  identify: (node: SceneNode) => string,
  options?: { descend: boolean }
): void {
  if (mappedIds.has(sourceId)) return
  const node = source.getNode(sourceId)
  if (!node) return
  const created = target.createNode(node.type, targetParentId, {
    // A file's layers name no component as an empty one; only a link makes the layer a copy,
    // which would drop the source a style is known by.
    ...cloneNodeProps(node, node.componentId),
    // A behaviour or other plugin content belongs to the asset; where it came from does not.
    pluginData: contentPluginData(node.pluginData),
    libraryLayerId: identify(node)
  })
  mappedIds.set(sourceId, created.id)
  if (options?.descend === false) return
  for (const childId of node.childIds)
    addSnapshotNode(source, target, childId, created.id, mappedIds, identify)
}

/**
 * A revision's graph: the published components with the components they use, the published
 * styles and the styles those use, and the variables, collections, and images all of them need.
 * `assetIds` limits what is published; every publishable component, style, and collection by
 * default. A keyless variant still brings its component set, so instances of it hash under that
 * set's key. Variables and collections keep their IDs, which are the source document's own.
 */
export function extractLibrarySnapshot(
  source: SceneGraph,
  assetIds?: string[],
  keepLayerIdentities = false
): PortableLibrarySnapshot {
  const selected = assetIds ? new Set(assetIds) : null
  const pick = <T extends { id: string }>(items: T[]): T[] =>
    selected ? items.filter((item) => selected.has(item.id)) : items
  const roots = pick(publishableLibraryRoots(source))
  const publishedStyles = pick(publishableLibraryStyles(source))
  const publishedCollections = pick(publishableLibraryCollections(source))
  const closure = collectNodeClosure(
    source,
    roots.map((node) => node.id)
  )
  const closureRoots = [...closure]
    .map((id) => source.getNode(id))
    .filter((node): node is SceneNode =>
      Boolean(node && (!node.parentId || !closure.has(node.parentId)))
    )
  // The set is not selected, but the variant still has to hash under its key.
  const variantSets = uniqBy(
    closureRoots.flatMap((node) => {
      const set = omittedVariantSet(source, closure, node)
      return set ? [set] : []
    }),
    (set) => set.id
  )
  const dependencies = layerDependencies(source, [
    ...[...closure].flatMap((id) => source.getNode(id) ?? []),
    ...variantSets,
    ...publishedStyles
  ])
  const styles = uniqBy([...publishedStyles, ...dependencies.styles], (node) => node.id)
  const snapshot = new SceneGraph()
  const page = snapshot.getPages()[0]
  page.name = 'Library definitions'
  page.internalOnly = true
  const mappedIds = new Map<string, string>()
  const identify = layerIdentities(source, keepLayerIdentities)
  for (const set of variantSets) {
    // Other variants of the set were not selected, and nothing here instances them.
    addSnapshotNode(source, snapshot, set.id, page.id, mappedIds, identify, { descend: false })
  }
  for (const root of [...closureRoots, ...styles]) {
    const set = omittedVariantSet(source, closure, root)
    const setId = set ? mappedIds.get(set.id) : undefined
    addSnapshotNode(source, snapshot, root.id, setId ?? page.id, mappedIds, identify)
  }
  for (const [sourceId, targetId] of mappedIds)
    if (sourceId === targetId) throw new Error('Snapshot IDs must be remapped')
  remapCopiedReferences(snapshot, mappedIds, { followTextLinks: true })

  // A published collection brings all its variables, and they the variables they alias.
  const published = variableDependencies(
    source,
    publishedCollections.flatMap((collection) => collection.variableIds)
  )
  copyVariableTables(
    snapshot,
    new Set([...dependencies.variables, ...published.variables]),
    new Set([
      ...dependencies.collections,
      ...published.collections,
      ...publishedCollections.map((collection) => collection.id)
    ]),
    () => [source]
  )
  copyImages(source.images, snapshot.images, dependencies.images)
  const mapped = (node: SceneNode): SceneNode[] => {
    const id = mappedIds.get(node.id)
    const copy = id ? snapshot.getNode(id) : undefined
    return copy ? [copy] : []
  }
  return {
    graph: snapshot,
    assetRoots: [...roots, ...publishedStyles].flatMap(mapped),
    collections: publishedCollections.flatMap(
      (collection) => snapshot.variableCollections.get(collection.id) ?? []
    )
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

/**
 * The asset an instance of `component` depends on. A variant is not published on its own: the set
 * is the asset a library lists and a consumer updates, so a variant with no key of its own takes
 * the set's. One that already has a key keeps it, as does every component outside a set, so a
 * library that already published under that key keeps the same content hash.
 */
function instanceDependencyKey(graph: SceneGraph, component: SceneNode): string {
  if (!existingAssetKey(component)) {
    const parent = component.parentId ? graph.getNode(component.parentId) : undefined
    if (parent?.type === 'COMPONENT_SET') return libraryAssetKey(parent)
  }
  return libraryAssetKey(component)
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
      ? instanceDependencyKey(graph, component)
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

/**
 * A collection as its content compares it: its modes and its variables in order, aliases and
 * modes named by their IDs, which a library's revisions share.
 */
export function canonicalLibraryCollection(
  graph: SceneGraph,
  collection: VariableCollection
): unknown {
  return {
    ...omit(collection, ['id', 'name', 'key', 'version', 'variableIds', 'pluginData']),
    pluginData: contentPluginData(collection.pluginData ?? []),
    variables: collection.variableIds.flatMap((id) => {
      const variable = graph.variables.get(id)
      if (!variable) return []
      return [
        {
          ...omit(variable, ['collectionId', 'key', 'version', 'pluginData']),
          pluginData: contentPluginData(variable.pluginData ?? [])
        }
      ]
    })
  }
}

export async function describeSnapshotAssets(
  snapshot: PortableLibrarySnapshot
): Promise<LibraryAssetDescriptor[]> {
  const nodes = snapshot.assetRoots.map(async (node) => ({
    ...libraryLayerAsset(node),
    contentHash: await contentHash(canonicalLibraryNode(snapshot.graph, node, new Set([node.id])))
  }))
  const collections = snapshot.collections.map(async (collection) => ({
    ...libraryCollectionAsset(collection),
    contentHash: await contentHash(canonicalLibraryCollection(snapshot.graph, collection))
  }))
  return Promise.all([...nodes, ...collections])
}
