import { isPlainObject, omit } from 'es-toolkit'
import * as v from 'valibot'

import type { Fill, GeometryPath, SceneNode, SourceMetadata } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'
import {
  deserializeInstanceOverrideState,
  serializeInstanceOverrideState
} from '@open-pencil/scene-graph/instances/overrides'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'
import { fillSchema } from '@open-pencil/scene-graph/paints'
import {
  matrixSchema,
  vectorSchema,
  type Matrix,
  type Vector
} from '@open-pencil/scene-graph/primitives'

import { ORDER_KEY_FIELD, PAGE_FIELD, PARENTS_FIELD } from '@/app/collab/shared-tree/fields'

import { writeRecord, type YFields } from './records'

const DERIVED_NODE_FIELDS = new Set<keyof SceneNode>(['textPicture'])
/**
 * The layer tree syncs as parent entries, order keys and pages (`src/app/collab/shared-tree/fields.ts`), so a
 * layer's own fields leave out its place in the tree, and decoding skips the tree's fields.
 */
const TREE_FIELDS = new Set<string>([
  'parentId',
  'childIds',
  PARENTS_FIELD,
  ORDER_KEY_FIELD,
  PAGE_FIELD
])
type YjsNodeLike = {
  entries(): IterableIterator<[string, unknown]>
}

/**
 * A layer's fields as a shared document can hold them. Yjs stores plain JSON, so the instance
 * overrides, kept in maps, are written as their serialized entries; written as maps they arrived
 * as empty objects, and the other peers lost every override.
 */
export function encodeNodeForYjs(node: SceneNode): Record<string, unknown> {
  const encoded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (DERIVED_NODE_FIELDS.has(key as keyof SceneNode) || TREE_FIELDS.has(key)) continue
    encoded[key] = structuredClone(value)
  }
  encoded.instanceOverrides = serializeInstanceOverrideState(node.instanceOverrides)
  return encoded
}

/**
 * The document node's plugin data is shared entry by entry beside the layers
 * (`src/app/collab/document/sync.ts`), so the document node's own map leaves it out.
 */
export const DOCUMENT_NODE_FIELDS: readonly (keyof SceneNode)[] = ['pluginData']

export function syncEncodedNodeToYMap(
  node: SceneNode,
  ynode: YFields,
  omitted: readonly (keyof SceneNode)[] = []
): void {
  for (const key of DERIVED_NODE_FIELDS) {
    if (ynode.has(key)) ynode.delete(key)
  }
  // The tree's fields live beside the layer's own, so fields the layer lacks are left alone.
  writeRecord(ynode, omit(encodeNodeForYjs(node), omitted), { drop: false })
}

export function decodeNodeFromYjs(ynode: YjsNodeLike): Partial<SceneNode> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of ynode.entries()) {
    if (DERIVED_NODE_FIELDS.has(key as keyof SceneNode) || TREE_FIELDS.has(key)) continue
    props[key] = structuredClone(value)
  }

  props.source = normalizeSourceMetadata(props.source)
  // Rooms written before overrides were serialized hold an empty object, which reads as none.
  if ('instanceOverrides' in props) {
    props.instanceOverrides = deserializeInstanceOverrideState(props.instanceOverrides)
  }
  if ('fillGeometry' in props) props.fillGeometry = normalizeGeometryPaths(props.fillGeometry)
  if ('strokeGeometry' in props) props.strokeGeometry = normalizeGeometryPaths(props.strokeGeometry)
  props.textPicture = null
  return props as Partial<SceneNode>
}

export function normalizeSourceMetadata(source: unknown): SourceMetadata {
  const defaults = createDefaultSourceMetadata()
  if (!isPlainObject(source)) return defaults

  const fig = isPlainObject(source.fig) ? source.fig : {}
  return {
    format: source.format === 'fig' ? 'fig' : null,
    id: stringOrNull(source.id),
    orderKey: stringOrNull(source.orderKey),
    editedFields: stringArray(source.editedFields),
    fig: {
      rawSize: normalizeVector(fig.rawSize),
      rawTransform: normalizeMatrix(fig.rawTransform),
      rawNodeFields: isPlainObject(fig.rawNodeFields) ? structuredClone(fig.rawNodeFields) : {},
      layout: isPlainObject(fig.layout)
        ? (structuredClone(fig.layout) as SourceMetadata['fig']['layout'])
        : null,
      symbolOverrides: arrayOrEmpty(fig.symbolOverrides),
      componentPropAssignments: arrayOrEmpty(fig.componentPropAssignments),
      derivedSymbolData: arrayOrEmpty(fig.derivedSymbolData),
      derivedSymbolDataLayoutVersion: numberOrNull(fig.derivedSymbolDataLayoutVersion),
      uniformScaleFactor: numberOrNull(fig.uniformScaleFactor)
    }
  }
}

function normalizeGeometryPaths(value: unknown): GeometryPath[] {
  if (!Array.isArray(value)) return []
  const paths: GeometryPath[] = []
  for (const item of value) {
    if (!isPlainObject(item) || !(item.commandsBlob instanceof Uint8Array)) continue
    const path: GeometryPath = {
      windingRule: item.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO',
      commandsBlob: new Uint8Array(item.commandsBlob)
    }
    const fills = normalizeFills(item.fills)
    if (fills.length > 0) path.fills = copyFills(fills)
    if (typeof item.fillStyleId === 'string') path.fillStyleId = item.fillStyleId
    paths.push(path)
  }
  return paths
}

function normalizeVector(value: unknown): Vector | null {
  const result = v.safeParse(vectorSchema, value)
  return result.success ? result.output : null
}

function normalizeMatrix(value: unknown): Matrix | null {
  const result = v.safeParse(matrixSchema, value)
  return result.success ? result.output : null
}

function normalizeFills(value: unknown): Fill[] {
  return Array.isArray(value) ? value.filter((fill): fill is Fill => v.is(fillSchema, fill)) : []
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? structuredClone(value) : []
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
