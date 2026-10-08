import {
  resolvedNumericBindings,
  resolvedPaintBindings,
  resolvedValueBindings,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

/**
 * Figma draws the value a bound field stores until something makes it resolve the binding
 * again, so each node is written with its bindings resolved for its mode. The editor resolves
 * colors only when drawing, and a graph bound without the editor keeps stale numbers too.
 * A node without an explicit mode takes its collection's default: the mode the editor happens
 * to show is not saved, and Figma opens the file in the default.
 */
export function nodeWithResolvedBindings(graph: SceneGraph, node: SceneNode): SceneNode {
  const changes = {
    ...resolvedNumericBindings(graph, node, 'default'),
    ...resolvedPaintBindings(graph, node, 'default'),
    ...resolvedValueBindings(graph, node, 'default')
  }
  return Object.keys(changes).length > 0 ? { ...node, ...changes } : node
}
