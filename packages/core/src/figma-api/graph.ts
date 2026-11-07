import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * The scene graph behind each `FigmaAPI` and node proxy. It lives here rather than on the
 * objects, so a script that walks `figma` or a node, symbols included, reaches no graph:
 * Figma's Plugin API has none, and writing to it would skip the API's checks and events.
 */
const graphs = new WeakMap<object, SceneGraph>()

/** Records the graph an API object or node proxy edits. */
export function bindGraph(owner: object, graph: SceneGraph): void {
  graphs.set(owner, graph)
}

/** The scene graph a `FigmaAPI` or node proxy edits, for OpenPencil's own code such as tools. */
export function graphOf(owner: object): SceneGraph {
  const graph = graphs.get(owner)
  if (!graph) throw new Error('No scene graph is bound to this object')
  return graph
}
