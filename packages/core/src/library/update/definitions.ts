import { countBy, groupBy } from 'es-toolkit/array'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'
import { findInstanceAncestor } from '@open-pencil/scene-graph/instances'

import { componentSyncOrder } from '#core/editor/component-sync'
import { instanceSwapPropertyIds, resolvedReferences } from '#core/library/copied-references'
import {
  copyImages,
  copyLibraryTree,
  getInternalLibraryPage,
  libraryDefinitionSource
} from '#core/library/materialize'
import type { ComponentLibraryRevision } from '#core/library/types'

export interface LibraryDefinitionUpdateOptions {
  /** The document's variable for a variable of the revision; the revision's own by default. */
  variable?: (id: string) => string
  /** The assets whose definitions to redraw; every definition of the library by default. */
  assetKeys?: ReadonlySet<string>
}

export interface LibraryDefinitionUpdate {
  /** Asset keys whose definitions now draw the revision. */
  updated: string[]
  /** Asset keys the revision draws as another kind of layer, whose instances must swap. */
  replaced: string[]
  /** Asset keys the revision no longer has. */
  missing: string[]
  /** Asset keys whose definitions stay at an earlier revision, as `assetKeys` leaves them out. */
  behind: string[]
}

/** A document layer and the revision layer it draws, with the tree both belong to. */
interface DefinitionPair {
  source: SceneNode
  target: SceneNode
  /** The document's layers of the tree, by the revision layer each one draws. */
  tree: Map<string, string>
}

function definitionRoots(graph: SceneGraph, libraryId: string): SceneNode[] {
  return graph
    .getPages(true)
    .filter((page) => page.internalOnly)
    .flatMap((page) => graph.getChildren(page.id))
    .filter((node) => node.librarySource?.identity.libraryId === libraryId)
}

/** The revision layer a definition draws: its asset's, or the layer it was copied from. */
function revisionRoot(revision: ComponentLibraryRevision, root: SceneNode): SceneNode | undefined {
  const source = root.librarySource
  if (!source) return undefined
  const descriptor = revision.manifest.assets.find(
    (asset) => asset.key === source.identity.assetKey
  )
  const id = descriptor?.sourceNodeId ?? source.sourceNodeId
  return id ? revision.graph.getNode(id) : undefined
}

/** The component, or its set, that a revision layer belongs to, which materializing copies whole. */
function revisionDefinitionRoot(
  revision: ComponentLibraryRevision,
  id: string
): SceneNode | undefined {
  let root: SceneNode | undefined
  for (let node = revision.graph.getNode(id); node && node.type !== 'CANVAS';) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') root = node
    node = node.parentId ? revision.graph.getNode(node.parentId) : undefined
  }
  return root
}

/** What pairs a layer copied before definitions recorded their library layer: its kind and name. */
const layerKey = (node: SceneNode) => `${node.type}:${node.name}`

/** Copies a revision tree into the document, pairing each copy with the layer it draws. */
function copyTree(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  sourceId: string,
  parentId: string,
  tree: Map<string, string>,
  pairs: DefinitionPair[]
): void {
  const copied = new Map<string, string>()
  copyLibraryTree(revision.graph, graph, sourceId, parentId, copied)
  for (const [id, targetId] of copied) {
    const source = revision.graph.getNode(id)
    const target = graph.getNode(targetId)
    if (!source || !target) continue
    tree.set(id, targetId)
    pairs.push({ source, target, tree })
  }
}

/**
 * Pairs each child of the revision layer `source` with the layer of `target` that draws it, as a
 * library update finds the layer an override names: by the library layer each copies. A layer
 * copied before definitions recorded it pairs by kind and name only when that names one layer on
 * each side, so an ambiguous or renamed one is never guessed.
 */
function matchChildren(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  source: SceneNode,
  target: SceneNode
): (readonly [SceneNode, SceneNode | undefined])[] {
  const layers = graph.getChildren(target.id)
  const byLibraryLayer = new Map(
    layers.flatMap((layer) =>
      layer.libraryLayerId ? [[layer.libraryLayerId, layer] as const] : []
    )
  )
  const children = revision.graph.getChildren(source.id)
  const unrecorded = new Map(
    Object.entries(
      groupBy(
        layers.filter((layer) => !layer.libraryLayerId),
        layerKey
      )
    )
  )
  const namesakes = countBy(children, layerKey)
  const paired = new Set<SceneNode>()
  return children.map((child) => {
    let pair = child.libraryLayerId ? byLibraryLayer.get(child.libraryLayerId) : undefined
    const byName = unrecorded.get(layerKey(child))
    if (!pair && byName?.length === 1 && namesakes[layerKey(child)] === 1) pair = byName[0]
    if (!pair || paired.has(pair)) return [child, undefined] as const
    paired.add(pair)
    return [child, pair] as const
  })
}

/**
 * Pairs the layers of `target` with those of the revision layer `source`. A revision layer left
 * without a pair is copied in; the layers left without one are returned for removal, and their
 * overrides go with them.
 */
function pairLayers(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  source: SceneNode,
  target: SceneNode,
  tree: Map<string, string>,
  pairs: DefinitionPair[]
): string[] {
  tree.set(source.id, target.id)
  pairs.push({ source, target, tree })
  const layers = graph.getChildren(target.id)
  const paired = new Set<SceneNode>()
  const removed: string[] = []
  for (const [child, pair] of matchChildren(graph, revision, source, target)) {
    if (pair) {
      paired.add(pair)
      removed.push(...pairLayers(graph, revision, child, pair, tree, pairs))
    } else copyTree(graph, revision, child.id, target.id, tree, pairs)
  }
  for (const layer of layers) if (!paired.has(layer)) removed.push(layer.id)
  return removed
}

/** Visits each layer of `target` with the layer of the revision layer `source` it draws. */
function matchTree(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  source: SceneNode,
  target: SceneNode,
  visit: (sourceId: string, targetId: string) => void
): void {
  visit(source.id, target.id)
  for (const [child, pair] of matchChildren(graph, revision, source, target))
    if (pair) matchTree(graph, revision, child, pair, visit)
}

const assetOf = (root: SceneNode) => root.librarySource?.identity.assetKey ?? root.id

/**
 * Pairs each definition with the revision layer it draws, reporting the ones the revision no
 * longer has or draws as another kind of layer, and the layers the revision drops.
 */
function pairDefinitions(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  roots: SceneNode[],
  pairs: DefinitionPair[]
): { result: LibraryDefinitionUpdate; removed: string[] } {
  const result: LibraryDefinitionUpdate = { updated: [], replaced: [], missing: [], behind: [] }
  const removed: string[] = []
  for (const root of roots) {
    const key = assetOf(root)
    const source = revisionRoot(revision, root)
    if (!source) {
      result.missing.push(key)
    } else if (source.type !== root.type) {
      result.replaced.push(key)
    } else {
      removed.push(...pairLayers(graph, revision, source, root, new Map(), pairs))
      result.updated.push(key)
    }
  }
  return { result, removed }
}

/**
 * Brings a document's definitions of a library to a revision in place: each takes the revision's
 * layers and fields but keeps its layers' IDs, so its instances, the copies of those inside other
 * components, and all their overrides keep pointing at it. Its instances then sync in the order
 * the editor syncs an edited component. A definition the revision draws as another kind of layer
 * stays as it was and is reported, for the caller to move its instances. With `assetKeys` only
 * those assets' definitions are redrawn. The document moves to the revision once none of its
 * definitions is left behind or replaced. A redrawn definition draws the components it uses from
 * the definitions already in the document, so a nested instance keeps the definition, and the
 * overrides, it had; only a component, or a layer of one, that none of them holds is copied in.
 */
export function updateLibraryDefinitions(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  { variable = (id) => id, assetKeys }: LibraryDefinitionUpdateOptions = {}
): LibraryDefinitionUpdate {
  const { libraryId, revisionId } = revision.manifest
  const pairs: DefinitionPair[] = []
  const definitions = definitionRoots(graph, libraryId)
  const outdated = definitions.filter(
    (root) => root.librarySource?.identity.revisionId !== revisionId
  )
  const redrawn = assetKeys ? outdated.filter((root) => assetKeys.has(assetOf(root))) : outdated
  const { result, removed } = pairDefinitions(graph, revision, redrawn, pairs)
  result.behind = outdated.filter((root) => !redrawn.includes(root)).map(assetOf)

  // A document can hold several copies of a definition, so each revision layer can have several.
  const copies = new Map<string, string[]>()
  const addCopy = (sourceId: string, targetId: string) => {
    copies.set(sourceId, [...(copies.get(sourceId) ?? []), targetId])
  }
  const collect = (from: number) => {
    for (const { source, target } of pairs.slice(from)) addCopy(source.id, target.id)
  }
  collect(0)
  for (const root of definitions) {
    if (redrawn.includes(root)) continue
    const source = revisionRoot(revision, root)
    if (source?.type === root.type) matchTree(graph, revision, source, root, addCopy)
  }
  /**
   * The document's copy of a revision layer: the one a layer already points at, or else the one
   * inside `scope`, the component an instance draws, as the copies inside an instance point into.
   */
  const copyOf = (sourceId: string, previous: string | null, scope: string | null): string => {
    if (!copies.has(sourceId)) {
      // A component the definitions use from this revision on.
      const root = revisionDefinitionRoot(revision, sourceId)
      if (!root) return sourceId
      const from = pairs.length
      copyTree(graph, revision, root.id, getInternalLibraryPage(graph).id, new Map(), pairs)
      collect(from)
    }
    const found = copies.get(sourceId) ?? [sourceId]
    if (previous && found.includes(previous)) return previous
    const inside = scope
      ? found.find((id) => id === scope || graph.isDescendant(id, scope))
      : undefined
    return inside ?? found[0]
  }

  // An instance-swap property names the components it offers by their revision IDs too.
  const swapProperties = instanceSwapPropertyIds(revision.graph.getAllNodes())
  // Pairs grow while this runs, as components new to the definitions are copied in.
  for (const { source, target, tree } of pairs) {
    // The copies inside an instance point into the component it draws.
    const scope = target.parentId
      ? (findInstanceAncestor(graph, target.parentId)?.componentId ?? null)
      : null
    // Where a layer came from in its file stays its own, so saving patches it in place.
    const { source: _origin, overrideKey: _overrideKey, ...fields } = cloneNodeProps(source, null)
    graph.updateNode(target.id, {
      ...fields,
      ...resolvedReferences(
        source,
        target,
        {
          component: (id, previous) => copyOf(id, previous, scope),
          // The layers an instance's overrides name are inside the component it draws.
          layer: (id, component) => tree.get(id) ?? copyOf(id, null, component),
          variable
        },
        swapProperties
      ),
      locked: true,
      boundVariables: Object.fromEntries(
        Object.entries(source.boundVariables).map(([field, id]) => [field, variable(id)])
      ),
      librarySource: libraryDefinitionSource(revision, source.id) ?? target.librarySource
    })
  }
  for (const id of removed) {
    // A variant the revision drops stays while instances draw it, as their component.
    if (graph.getNode(id)?.type === 'COMPONENT' && graph.getInstances(id).length > 0) continue
    graph.deleteNode(id)
  }
  for (const { source, target, tree } of pairs) {
    source.childIds.forEach((childId, index) => {
      const child = tree.get(childId)
      if (child) graph.insertChildAt(child, target.id, index)
    })
  }

  copyImages(
    revision.graph,
    graph,
    new Map(pairs.map(({ source, target }) => [source.id, target.id]))
  )
  // The document uses the revision once no definition it holds is left behind.
  if (result.behind.length === 0 && result.replaced.length === 0)
    graph.enabledLibraries.set(libraryId, { libraryId, revisionId, enabled: true })
  const components = pairs.flatMap(({ target }) => (target.type === 'COMPONENT' ? [target.id] : []))
  graph.syncInstancesTogether(componentSyncOrder(graph, new Set(components)))
  return result
}
