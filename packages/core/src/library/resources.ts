import type { SceneGraph, SceneNode, Variable, VariableCollection } from '@open-pencil/scene-graph'
import {
  collectionAssetKey,
  derivedAssetVersion,
  styleAssetKey,
  variableAssetKey
} from '@open-pencil/scene-graph/asset-keys'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'
import { remapInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'
import { internalCanvas, newSharedStyleId } from '@open-pencil/scene-graph/shared-styles'
import {
  layerDependencies,
  remappedResourceReferences,
  type ResourceReferences
} from '@open-pencil/scene-graph/transfer'
import { mapVariableValueReferences } from '@open-pencil/scene-graph/variables'

import { reconcileVariableLayouts } from '#core/layout/variables'

import type { ComponentLibraryRevision } from './types'

/** A revision's variables, collections, modes, and styles, as the document now names them. */
export type LibraryResourceReferences = Omit<ResourceReferences, 'layer'>

function lookup(ids: ReadonlyMap<string, string>): (id: string) => string {
  return (id) => ids.get(id) ?? id
}

/** The document's copy of a library collection: the one holding its key. */
function libraryCollection(graph: SceneGraph, key: string): VariableCollection | undefined {
  return [...graph.variableCollections.values()].find((collection) => collection.key === key)
}

/**
 * The document's copy of `collection`, with a mode for each of its modes, matched by name. A
 * copy is the library's, so it takes the revision's name and mode names each time.
 */
function importCollection(
  graph: SceneGraph,
  collection: VariableCollection,
  modes: Map<string, string>
): VariableCollection {
  const key = collectionAssetKey(collection)
  const existing = libraryCollection(graph, key)
  const copy = existing ?? graph.createCollection(collection.name)
  // A copy keeps its modes by name; a new one's first mode is the one it was made with.
  const byName = new Map(
    existing
      ? existing.modes.map((mode) => [mode.name, mode.modeId])
      : copy.modes.slice(0, 1).map((mode) => [collection.modes[0]?.name ?? mode.name, mode.modeId])
  )
  collection.modes.forEach((mode) => {
    const kept = byName.get(mode.name)
    const modeId = kept ?? graph.createMode(copy.id, mode.name)
    if (!modeId) throw new Error(`Cannot add mode ${mode.name} to ${collection.name}`)
    modes.set(mode.modeId, modeId)
  })
  Object.assign(copy, {
    name: collection.name,
    key,
    version: derivedAssetVersion(JSON.stringify(collection)),
    modeAttribute: collection.modeAttribute,
    modes: copy.modes.map((mode) => {
      const source = collection.modes.find((entry) => modes.get(entry.modeId) === mode.modeId)
      return source ? { ...mode, name: source.name } : mode
    }),
    defaultModeId: modes.get(collection.defaultModeId) ?? copy.defaultModeId
  })
  return copy
}

/** The document's copy of `variable` in `collectionId`, by its key; made when it has none. */
function importVariable(graph: SceneGraph, variable: Variable, collectionId: string): Variable {
  const key = variableAssetKey(variable)
  const existing = [...graph.variables.values()].find(
    (candidate) => candidate.key === key && candidate.collectionId === collectionId
  )
  return existing ?? graph.createVariable(variable.name, variable.type, collectionId)
}

/** The document's style for a library style: the copy the library brought in, or a new one. */
function importStyle(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  style: SceneNode
): SceneNode {
  const { libraryId, revisionId } = revision.manifest
  const assetKey = styleAssetKey(style)
  const existing = [...graph.getAllNodes()].find(
    (node) =>
      node.sharedStyleType !== null &&
      node.librarySource?.identity.libraryId === libraryId &&
      node.librarySource.identity.assetKey === assetKey
  )
  const librarySource = {
    identity: { libraryId, assetKey, revisionId },
    sourceNodeId: style.id,
    readOnly: true
  }
  if (existing) {
    const { source: _source, ...fields } = cloneNodeProps(style, null)
    graph.updateNode(existing.id, { ...fields, locked: true, librarySource })
    return existing
  }
  const taken = [...graph.getAllNodes()].some(
    (node) => node.sharedStyleType !== null && node.source.id === style.source.id
  )
  const copy = graph.createNode(style.type, internalCanvas(graph).id, {
    ...cloneNodeProps(style, null),
    // Styles from Figma share IDs across files; a taken one gets the document a new one.
    source: { ...style.source, id: taken ? newSharedStyleId() : style.source.id },
    locked: true,
    librarySource
  })
  return copy
}

/**
 * Brings the styles, variables, collections, and images that `layers` of `revision` use into
 * `graph` as the library's, and returns how the revision's references name them there. A collection the
 * document already has from the library, by key, is reused and takes the revision's values, as
 * does a style; both are read-only copies, so nothing of the document's own changes.
 */
export function importLibraryResources(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  layers: Iterable<SceneNode>
): LibraryResourceReferences & { styleLayers: string[]; variables: string[] } {
  const source = revision.graph
  const dependencies = layerDependencies(source, layers)
  const collections = new Map<string, string>()
  const modes = new Map<string, string>()
  const variables = new Map<string, string>()
  const styles = new Map<string, string>()
  for (const id of dependencies.collections) {
    const collection = source.variableCollections.get(id)
    if (collection) collections.set(id, importCollection(graph, collection, modes).id)
  }
  const imported: Array<[Variable, Variable]> = []
  for (const id of dependencies.variables) {
    const variable = source.variables.get(id)
    const collectionId = variable ? collections.get(variable.collectionId) : undefined
    if (!variable || !collectionId) continue
    const copy = importVariable(graph, variable, collectionId)
    variables.set(id, copy.id)
    imported.push([variable, copy])
  }
  const references = {
    variable: lookup(variables),
    collection: lookup(collections),
    mode: lookup(modes),
    style: lookup(styles)
  }
  // Values name other variables and modes, so they are written once every copy exists.
  for (const [variable, copy] of imported) {
    const collection = graph.variableCollections.get(copy.collectionId)
    Object.assign(copy, {
      ...structuredClone(variable),
      id: copy.id,
      collectionId: copy.collectionId,
      key: variableAssetKey(variable),
      version: derivedAssetVersion(JSON.stringify(variable)),
      valuesByMode: Object.fromEntries(
        Object.entries(variable.valuesByMode).map(([modeId, value]) => [
          references.mode(modeId),
          mapVariableValueReferences(value, references.variable, references.mode)
        ])
      ),
      expressions:
        variable.expressions &&
        Object.fromEntries(
          Object.entries(variable.expressions).map(([modeId, expression]) => [
            references.mode(modeId),
            expression
          ])
        )
    })
    if (collection && !collection.variableIds.includes(copy.id))
      collection.variableIds.push(copy.id)
  }
  for (const hash of dependencies.images) {
    const bytes = source.images.get(hash)
    if (bytes && !graph.images.has(hash)) graph.images.set(hash, new Uint8Array(bytes))
  }
  const styleLayers: string[] = []
  for (const style of dependencies.styles) {
    const copy = importStyle(graph, revision, style)
    styleLayers.push(copy.id)
    if (style.source.id && copy.source.id) styles.set(style.source.id, copy.source.id)
  }
  // A style binds variables and names other styles by the revision's IDs until it is remapped.
  remapLibraryResources(graph, styleLayers, references)
  return { ...references, styleLayers, variables: [...variables.values()] }
}

/** Points `ids` at the document's copies of the revision's variables, modes, and styles. */
export function remapLibraryResources(
  graph: SceneGraph,
  ids: Iterable<string>,
  references: LibraryResourceReferences
): void {
  for (const id of ids) {
    const node = graph.getNode(id)
    if (!node) continue
    graph.updateNode(id, {
      ...remappedResourceReferences(node, references),
      instanceOverrides: remapInstanceOverrideState(node.instanceOverrides, {
        node: (layer) => layer,
        variable: references.variable,
        collection: references.collection
      })
    })
  }
}

/**
 * Brings what `layers` of `revision` use into `graph` and points `ids`, their copies there, at
 * it. Layers bound to a variable whose value the revision changed take the new value, and the
 * layout it changes, as editing the variable would give them.
 */
export function applyLibraryResources(
  graph: SceneGraph,
  ids: Iterable<string>,
  revision: ComponentLibraryRevision,
  layers: Iterable<SceneNode>
): void {
  const imported = importLibraryResources(graph, revision, layers)
  remapLibraryResources(graph, ids, imported)
  reconcileVariableLayouts(graph, { variables: imported.variables })
}
