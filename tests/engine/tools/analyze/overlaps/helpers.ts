import type { SceneGraph } from '@open-pencil/core'

export function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

export function rect(
  graph: SceneGraph,
  name: string,
  parentId: string,
  x = 0,
  y = 0,
  w = 50,
  h = 50
) {
  return graph.createNode('RECTANGLE', parentId, { name, x, y, width: w, height: h })
}

export function frame(
  graph: SceneGraph,
  name: string,
  parentId: string,
  x = 0,
  y = 0,
  w = 100,
  h = 100,
  clipsContent = false
) {
  return graph.createNode('FRAME', parentId, {
    name,
    x,
    y,
    width: w,
    height: h,
    clipsContent
  })
}

export function text(
  graph: SceneGraph,
  name: string,
  parentId: string,
  x = 0,
  y = 0,
  w = 100,
  h = 20
) {
  return graph.createNode('TEXT', parentId, {
    name,
    x,
    y,
    width: w,
    height: h,
    text: name,
    fontSize: 14
  })
}
