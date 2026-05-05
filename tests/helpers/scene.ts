import { SceneGraph } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/core'

export function makeSceneGraph(pageName = 'Test'): SceneGraph {
  const graph = new SceneGraph()
  graph.addPage(pageName)
  return graph
}

export function firstPageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

export function createRect(
  graph: SceneGraph,
  parentId: string,
  props: { name?: string; x?: number; y?: number; width?: number; height?: number } = {}
): SceneNode {
  return graph.createNode('RECTANGLE', parentId, {
    name: props.name ?? 'Rect',
    x: props.x ?? 0,
    y: props.y ?? 0,
    width: props.width ?? 50,
    height: props.height ?? 50
  })
}
