import { mapValues } from 'es-toolkit'
import { fromUint8Array, isValid, toUint8Array } from 'js-base64'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { PortableSceneGraphData } from '#core/kiwi/fig/parse/portable-data'

import type { ComponentLibraryManifest, ComponentLibraryRevision } from './types'

export type SerializedLibraryGraph = PortableSceneGraphData

export interface SerializedComponentLibraryRevision {
  manifest: ComponentLibraryManifest
  graph: SerializedLibraryGraph
}

export function serializeLibraryRevision(
  revision: ComponentLibraryRevision
): SerializedComponentLibraryRevision {
  return {
    manifest: structuredClone(revision.manifest),
    graph: {
      rootId: revision.graph.rootId,
      nodes: [...revision.graph.nodes].map(([id, node]) => [id, structuredClone(node)]),
      images: [...revision.graph.images].map(([hash, bytes]) => [hash, new Uint8Array(bytes)]),
      variables: [...revision.graph.variables].map(([id, variable]) => [
        id,
        structuredClone(variable)
      ]),
      variableCollections: [...revision.graph.variableCollections].map(([id, collection]) => [
        id,
        structuredClone(collection)
      ]),
      activeMode: [...revision.graph.activeMode],
      documentColorSpace: revision.graph.documentColorSpace
    }
  }
}

const MAP_TAG = 'openpencil/map'
const OBJECT_TAG = 'openpencil/object'

function encodeStoredValue(value: unknown): unknown {
  if (value instanceof Map) {
    return {
      $openPencilType: MAP_TAG,
      entries: [...value].map(([key, entry]) => [encodeStoredValue(key), encodeStoredValue(entry)])
    }
  }
  if (value instanceof Uint8Array) return { $bytes: fromUint8Array(value) }
  if (Array.isArray(value)) return value.map(encodeStoredValue)
  if (value && typeof value === 'object') {
    const encoded = mapValues(value, encodeStoredValue)
    // An object that already looks like a tag is wrapped, so decoding cannot mistake it for one.
    return '$openPencilType' in value || '$bytes' in value
      ? { $openPencilType: OBJECT_TAG, value: encoded }
      : encoded
  }
  return value
}

/**
 * A revision as a catalog writes it to JSON: the serialized revision with its `Map`s (instance
 * overrides) and byte arrays (images, geometry) tagged, since JSON keeps neither.
 */
export function encodeStoredLibraryRevision(revision: ComponentLibraryRevision): unknown {
  return encodeStoredValue(serializeLibraryRevision(revision))
}

/** Reverses `encodeStoredLibraryRevision` on parsed JSON; the result still needs validating. */
export function decodeStoredLibraryValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeStoredLibraryValue)
  if (!value || typeof value !== 'object') return value
  if ('$openPencilType' in value) {
    if (
      value.$openPencilType === OBJECT_TAG &&
      'value' in value &&
      value.value &&
      typeof value.value === 'object' &&
      !Array.isArray(value.value)
    ) {
      return mapValues(value.value, decodeStoredLibraryValue)
    }
    if (value.$openPencilType === MAP_TAG && 'entries' in value && Array.isArray(value.entries)) {
      return new Map(
        value.entries.flatMap((entry) =>
          Array.isArray(entry) && entry.length === 2
            ? [[decodeStoredLibraryValue(entry[0]), decodeStoredLibraryValue(entry[1])] as const]
            : []
        )
      )
    }
  }
  if ('$bytes' in value && typeof value.$bytes === 'string' && isValid(value.$bytes)) {
    return toUint8Array(value.$bytes)
  }
  return mapValues(value, decodeStoredLibraryValue)
}

function cloneLibraryNode(node: SceneNode): SceneNode {
  const cloned = structuredClone(node)
  return Array.isArray(cloned.guides) ? cloned : { ...cloned, guides: [] }
}

export function deserializeLibraryRevision(
  revision: SerializedComponentLibraryRevision
): ComponentLibraryRevision {
  const graph = new SceneGraph()
  graph.rootId = revision.graph.rootId
  graph.nodes = new Map(revision.graph.nodes.map(([id, node]) => [id, cloneLibraryNode(node)]))
  graph.images = new Map(
    revision.graph.images.map(([hash, bytes]) => [hash, new Uint8Array(bytes)])
  )
  graph.variables = new Map(revision.graph.variables)
  graph.variableCollections = new Map(revision.graph.variableCollections)
  graph.activeMode = new Map(revision.graph.activeMode)
  graph.documentColorSpace = revision.graph.documentColorSpace
  graph.instanceIndex = new Map()
  for (const node of graph.getAllNodes()) {
    if (node.type === 'CONNECTOR') graph.connectorIds.add(node.id)
    if (!node.componentId) continue
    const instances = graph.instanceIndex.get(node.componentId) ?? new Set<string>()
    instances.add(node.id)
    graph.instanceIndex.set(node.componentId, instances)
  }
  return { manifest: structuredClone(revision.manifest), graph }
}
