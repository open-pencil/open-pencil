import { SceneGraph } from '@open-pencil/core'

export function createClipboardGraph(): { graph: SceneGraph; pageId: string } {
  const graph = new SceneGraph()
  graph.addPage('Test')
  return { graph, pageId: graph.rootId }
}
