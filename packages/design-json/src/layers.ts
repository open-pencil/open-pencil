import { addComputed } from '#design-json/computed'
import { keepsField, type ResolvedOptions } from '#design-json/options'
import type { DesignJSONLayer } from '#design-json/types'
import { toJSONValue } from '#design-json/values'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

/**
 * Everything writing a layer needs: the graph, the options, whether the layer is a main
 * component's or a shared style's, and the comment threads pinned to each layer.
 */
export interface LayerWriter {
  graph: SceneGraph
  options: ResolvedOptions
  component: boolean
  commentThreadIds: Readonly<Record<string, string[]>>
}

/** The writer for a main component or a shared style, which is written whole. */
export function wholeLayerWriter(writer: LayerWriter): LayerWriter {
  const options = { ...writer.options, depth: Number.POSITIVE_INFINITY }
  return { ...writer, options, component: true }
}

/** The fields every layer keeps, first and in this order, whatever `pick` and `omit` say. */
const IDENTITY_FIELDS: ReadonlySet<string> = new Set(['id', 'type', 'name'])

/** The layers with these IDs, skipping IDs the graph lacks and layers the transform rejects. */
export function writeLayersById(
  writer: LayerWriter,
  nodeIds: readonly string[],
  depth = 0
): DesignJSONLayer[] {
  return nodeIds.flatMap((id) => {
    const layer = writeLayerById(writer, id, depth)
    return layer ? [layer] : []
  })
}

function writeLayerById(writer: LayerWriter, id: string, depth: number): DesignJSONLayer | null {
  const node = writer.graph.getNode(id)
  if (!node) return null
  return writeLayer(writer, node, depth)
}

/** One layer: its fields, what is computed for it, its box, its children, then the transform. */
export function writeLayer(
  writer: LayerWriter,
  node: SceneNode,
  depth: number
): DesignJSONLayer | null {
  const nestsChildren = shouldNestChildren(writer, node, depth)
  const layer = writeFields(writer, node, nestsChildren)
  addComputed(writer, node, layer)
  addWorldBounds(writer, node, layer)
  if (nestsChildren) layer.children = writeLayersById(writer, node.childIds, depth + 1)
  return applyTransform(writer, layer, node, depth)
}

function shouldNestChildren(writer: LayerWriter, node: SceneNode, depth: number): boolean {
  return depth < writer.options.depth && node.childIds.length > 0
}

function writeFields(
  writer: LayerWriter,
  node: SceneNode,
  nestsChildren: boolean
): DesignJSONLayer {
  const layer: DesignJSONLayer = { id: node.id, type: node.type, name: node.name }
  for (const [field, value] of Object.entries(node)) {
    if (!writesField(writer.options, field, nestsChildren)) continue
    const written = fieldValue(value, writer.options)
    if (written !== undefined) layer[field] = written
  }
  return layer
}

function writesField(options: ResolvedOptions, field: string, nestsChildren: boolean): boolean {
  // Written first, by writeFields itself.
  if (IDENTITY_FIELDS.has(field)) return false
  // Children nested below stand in for their IDs.
  if (field === 'childIds' && nestsChildren) return false
  return keepsField(field, options)
}

/**
 * A field's value as JSON. A field the layer leaves unset is null, so every layer lists every
 * field it has; undefined means the field is left out, as bytes can be.
 */
function fieldValue(value: unknown, options: ResolvedOptions): unknown {
  if (value === undefined) return null
  return toJSONValue(value, options.bytes)
}

function addWorldBounds(writer: LayerWriter, node: SceneNode, layer: DesignJSONLayer) {
  if (!writer.options.worldBounds) return
  // A page has no box of its own.
  if (node.type === 'CANVAS') return
  if (!keepsField('worldBounds', writer.options)) return
  layer.worldBounds = getAxisAlignedWorldBounds(node, writer.graph)
}

function applyTransform(
  writer: LayerWriter,
  layer: DesignJSONLayer,
  node: SceneNode,
  depth: number
): DesignJSONLayer | null {
  const { transform } = writer.options
  if (!transform) return layer
  return transform(layer, node, { graph: writer.graph, depth, component: writer.component })
}

/** Each layer in the tree, the layer before its children. */
export function* layersIn(layers: readonly DesignJSONLayer[]): Generator<DesignJSONLayer> {
  for (const layer of layers) {
    yield layer
    if (layer.children) yield* layersIn(layer.children)
  }
}
