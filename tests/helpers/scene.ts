import { SceneGraph } from '@open-pencil/core'
import type { Color, SceneNode } from '@open-pencil/core'

export function makeSceneGraph(pageName = 'Test'): SceneGraph {
  const graph = new SceneGraph()
  graph.addPage(pageName)
  return graph
}

export function firstPageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

export function addTestColorVariable(
  graph: SceneGraph,
  id: string,
  name: string,
  value: Color = { r: 1, g: 1, b: 1, a: 1 }
): void {
  if (!graph.variableCollections.has('colors')) {
    graph.addCollection({
      id: 'colors',
      name: 'Colors',
      modes: [{ modeId: 'light', name: 'Light' }],
      defaultModeId: 'light',
      variableIds: []
    })
  }

  graph.addVariable({
    id,
    name,
    type: 'COLOR',
    collectionId: 'colors',
    valuesByMode: { light: value },
    description: '',
    hiddenFromPublishing: false
  })
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
