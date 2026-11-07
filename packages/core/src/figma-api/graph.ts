import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * Where a `FigmaAPI` keeps its scene graph. The graph is OpenPencil's own and Figma's Plugin API
 * has no such field, so it stays off the object scripts see as `figma`.
 */
export const API_GRAPH = Symbol('graph')

export interface GraphHost {
  readonly [API_GRAPH]: SceneGraph
}

/** The scene graph a `FigmaAPI` edits, for OpenPencil's own code such as tools. */
export function graphOf(api: GraphHost): SceneGraph {
  return api[API_GRAPH]
}
