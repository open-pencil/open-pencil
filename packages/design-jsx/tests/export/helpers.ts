import { SceneGraph } from '@open-pencil/scene-graph'

/** A graph with an extra page named Page 1, as the export tests draw on. */
export function makeGraph() {
  const graph = new SceneGraph()
  graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
  return graph
}

/** The graph's first page. */
export function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}
