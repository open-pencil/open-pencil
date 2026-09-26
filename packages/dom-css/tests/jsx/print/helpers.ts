import { sceneNodesToTailwindJSX } from '#dom-css/index'

import { SceneGraph } from '@open-pencil/scene-graph'

export function makeGraph() {
  const graph = new SceneGraph()
  graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
  return graph
}

export function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

export function tw(graph: SceneGraph, nodeId: string) {
  return sceneNodesToTailwindJSX(graph, [nodeId])
}
