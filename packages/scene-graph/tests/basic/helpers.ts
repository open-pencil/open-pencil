import type { SceneGraph } from '@open-pencil/scene-graph'
export function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

/** A fill that shows, so the layer takes clicks as a drawn shape does. */
export const SOLID_FILL = {
  type: 'SOLID' as const,
  color: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
  opacity: 1,
  visible: true
}

export function rect(graph: SceneGraph, name: string, x = 0, y = 0, w = 50, h = 50) {
  return graph.createNode('RECTANGLE', pageId(graph), {
    name,
    x,
    y,
    width: w,
    height: h,
    fills: [SOLID_FILL]
  }).id
}
