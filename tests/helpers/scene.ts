import { SceneGraph } from '@open-pencil/core'

export function makeSceneGraph(pageName = 'Test'): SceneGraph {
  const graph = new SceneGraph()
  graph.addPage(pageName)
  return graph
}
