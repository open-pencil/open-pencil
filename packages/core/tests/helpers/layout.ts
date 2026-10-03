import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export function autoFrame(
  graph: SceneGraph,
  parentId: string,
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return graph.createNode('FRAME', parentId, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    width: 400,
    height: 200,
    ...overrides
  })
}

export function rect(
  graph: SceneGraph,
  parentId: string,
  w = 50,
  h = 50,
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return graph.createNode('RECTANGLE', parentId, {
    name: 'Rect',
    width: w,
    height: h,
    ...overrides
  })
}
