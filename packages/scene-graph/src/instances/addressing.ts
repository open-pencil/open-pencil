import type { SceneGraph } from '../index'
import {
  hasInstanceOverride,
  instanceOverridesAt,
  setInstanceOverride,
  type InstanceOverrideField,
  type OverridePath
} from '../instance-overrides'
import type { SceneNode } from '../types'
import { instanceLayerId, parseInstanceLayerId } from './layer-ids'
import { layerOverrideValue } from './override-values'

/** The instance that records a layer's overrides, and the layer's path in it. */
export interface OverrideTarget {
  owner: SceneNode
  path: OverridePath
}

/**
 * Where overrides of `node` are recorded: on the outermost instance its id names, at its path,
 * or on the node itself when it is an instance of its own. Layers that are not copies, such as
 * slot content an instance holds, have no override target.
 */
export function overrideTarget(graph: SceneGraph, node: SceneNode): OverrideTarget | undefined {
  const address = parseInstanceLayerId(node.id)
  if (address) {
    const owner = graph.getNode(address.owner)
    return owner ? { owner, path: address.path } : undefined
  }
  return node.type === 'INSTANCE' ? { owner: node, path: [] } : undefined
}

/**
 * Records a field of `node` as overridden on the instance that holds its overrides, with `value`
 * or else what the layer shows now. Returns that instance, which the caller updates; layers that
 * are not copies or instances have none.
 */
export function setLayerOverride(
  graph: SceneGraph,
  node: SceneNode,
  field: InstanceOverrideField,
  value: unknown = layerOverrideValue(node, field)
): SceneNode | undefined {
  const target = overrideTarget(graph, node)
  if (!target) return undefined
  setInstanceOverride(target.owner.instanceOverrides, target.path, field, value)
  return target.owner
}

/** The fields overridden on `node`, empty when it is not a copy or nothing is overridden. */
export function overriddenFields(
  graph: SceneGraph,
  node: SceneNode
): ReadonlySet<InstanceOverrideField> {
  const target = overrideTarget(graph, node)
  return new Set(
    target ? instanceOverridesAt(target.owner.instanceOverrides, target.path).keys() : []
  )
}

/** Whether the nested instance at `path` shows another component than its component layer. */
export function isSwappedAt(owner: SceneNode, path: OverridePath): boolean {
  return hasInstanceOverride(owner.instanceOverrides, path, 'componentId')
}

/** Whether a copy of an instance is swapped, so its contents come from its own component. */
export function isSwappedCopy(graph: SceneGraph, instance: SceneNode): boolean {
  const target = overrideTarget(graph, instance)
  return target !== undefined && target.path.length > 0 && isSwappedAt(target.owner, target.path)
}

/**
 * The id of the component layer `path` copies inside `owner`. Without swaps that is the layer
 * of the owner's component at `path`: its own layer, or the copy inside one of its nested
 * instances. Below a swapped nested instance it is a layer of the component swapped in.
 */
export function sourceLayerId(owner: SceneNode, path: OverridePath): string {
  let start = 0
  for (let length = path.length - 1; length >= 1; length--) {
    if (isSwappedAt(owner, path.slice(0, length))) {
      start = length
      break
    }
  }
  const [first, ...rest] = path.slice(start)
  return rest.length === 0 ? first : instanceLayerId(first, rest)
}

/** The component layer a copy shows before its overrides, when it still exists. */
export function instanceLayerSource(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  const target = overrideTarget(graph, node)
  if (!target || target.path.length === 0) return undefined
  return graph.getNode(sourceLayerId(target.owner, target.path))
}

/**
 * The component layers a copy derives from, nearest first: the layer it copies, that layer's own
 * source when it is a copy inside a nested instance, and so on to a component's own layer.
 */
export function instanceLayerLineage(graph: SceneGraph, node: SceneNode): SceneNode[] {
  const lineage: SceneNode[] = []
  for (let source = instanceLayerSource(graph, node); source;) {
    if (lineage.includes(source)) break
    lineage.push(source)
    source = instanceLayerSource(graph, source)
  }
  return lineage
}
