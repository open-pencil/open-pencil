import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createStyleBindingLookup,
  resolvedEffectBindings,
  resolvedNumericBindings,
  resolvedRunBindings,
  resolvedValueBindings,
  type TextStyleLookup
} from '@open-pencil/scene-graph/variables'

/**
 * Figma draws the value a bound field stores until something makes it resolve the binding
 * again, so each node is written with its bindings resolved for its mode, as a graph bound
 * without the editor keeps stale numbers. A bound paint is written as it stores its color and
 * opacity, which are Figma's cache of its variable, edits included.
 */
export function nodeWithResolvedBindings(
  graph: SceneGraph,
  node: SceneNode,
  styles: TextStyleLookup
): SceneNode {
  const changes = {
    ...resolvedNumericBindings(graph, node, styles),
    ...resolvedValueBindings(graph, node),
    ...resolvedRunBindings(graph, node, styles),
    ...resolvedEffectBindings(graph, node)
  }
  return Object.keys(changes).length > 0 ? { ...node, ...changes } : node
}

interface ExportedNodes {
  graph: SceneGraph
  resolvedNodes?: WeakMap<SceneNode, SceneNode>
  textStyles?: TextStyleLookup
}

/**
 * `nodeWithResolvedBindings` once per node for one export. Bindings do not change while a document
 * is written, and an instance's overrides claim the same layers once per overridden field.
 */
export function exportedNode(context: ExportedNodes, node: SceneNode): SceneNode {
  context.resolvedNodes ??= new WeakMap()
  let resolved = context.resolvedNodes.get(node)
  if (!resolved) {
    context.textStyles ??= createStyleBindingLookup(context.graph)
    resolved = nodeWithResolvedBindings(context.graph, node, context.textStyles)
    context.resolvedNodes.set(node, resolved)
  }
  return resolved
}

export function asResolved(context: ExportedNodes, copy: SceneNode): SceneNode {
  context.resolvedNodes ??= new WeakMap()
  context.resolvedNodes.set(copy, copy)
  return copy
}
