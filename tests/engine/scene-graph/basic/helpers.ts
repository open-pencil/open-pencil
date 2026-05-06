import type { SceneGraph } from '@open-pencil/core'
export function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

export function rect(graph: SceneGraph, name: string, x = 0, y = 0, w = 50, h = 50) {
  return graph.createNode('RECTANGLE', pageId(graph), { name, x, y, width: w, height: h }).id
}
