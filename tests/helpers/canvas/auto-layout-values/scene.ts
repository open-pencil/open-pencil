import type { Fill, SceneGraph } from '@lawha/scene-graph'

const solid = (r: number, g: number, b: number): Fill[] => [
  { type: 'SOLID', color: { r, g, b, a: 1 }, opacity: 1, visible: true }
]

/** A row with an 8 px gap and 37 px side padding, as Figma desktop 126 was hovered over. */
export function createAutoLayoutValueScene(graph: SceneGraph, pageId: string) {
  const row = graph.createNode('FRAME', pageId, {
    name: 'Row',
    x: 0,
    y: 0,
    width: 242,
    height: 100,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 8,
    paddingLeft: 37,
    paddingRight: 37,
    paddingTop: 20,
    paddingBottom: 20,
    fills: solid(1, 1, 1)
  })
  for (const name of ['A', 'B'])
    graph.createNode('RECTANGLE', row.id, {
      name,
      width: 80,
      height: 60,
      fills: solid(0.85, 0.85, 0.85)
    })
  return row.id
}
