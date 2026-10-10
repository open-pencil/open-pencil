// The values instance overrides hold: what a layer shows in its component's own space.
import type { SceneGraph } from '../index'
import type { InstanceOverrideField } from '../instance-overrides'
import { scaleFieldValue } from '../scaling/node'
import type { SceneNode } from '../types'
import { instanceLayerId, parseOverridePathKey } from './layer-ids'

function isNodeField(node: SceneNode, field: InstanceOverrideField): field is keyof SceneNode {
  return Object.hasOwn(node, field)
}

/**
 * The value an override of `field` records for `node`: its current value without the layer's
 * `componentScale`, so it holds however the instance is scaled later. A field that names no
 * node property, such as one binding, has no value to read here.
 */
export function layerOverrideValue(node: SceneNode, field: InstanceOverrideField): unknown {
  if (!isNodeField(node, field)) return undefined
  const value = structuredClone(node[field])
  return scaleFieldValue(field, value, 1 / node.componentScale)
}

/** A recorded override value as a layer drawn at `componentScale` shows it. */
export function appliedOverrideValue<K extends keyof SceneNode>(
  field: K,
  value: unknown,
  componentScale: number
): SceneNode[K] {
  return scaleFieldValue(field, structuredClone(value) as SceneNode[K], componentScale)
}

/**
 * Takes the values `instance` records for the layers inside it from those layers. A reader
 * records which fields a file overrides while it builds the copies, before later passes, such
 * as resolving style references, settle what the layers show.
 */
export function takeOverrideValuesFromLayers(graph: SceneGraph, instance: SceneNode): void {
  for (const [key, fields] of instance.instanceOverrides.layers) {
    const layer = graph.getNode(instanceLayerId(instance.id, parseOverridePathKey(key)))
    if (!layer) continue
    for (const field of fields.keys()) {
      const value = layerOverrideValue(layer, field)
      if (value !== undefined) fields.set(field, value)
    }
  }
}
