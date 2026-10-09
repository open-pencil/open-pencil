import { expect, test } from 'bun:test'

import { fitEnclosingGroups, SceneGraph } from '@open-pencil/scene-graph'

// Live Figma 126: a group holding a rectangle, then a mask ellipse, then a larger rectangle
// measures 0,0 150×150, and moving the masked rectangle leaves it unchanged.
test('a group with a mask spans the layers below the mask and the mask', () => {
  const graph = new SceneGraph()
  const group = graph.createNode('GROUP', graph.getPages()[0].id, { width: 1, height: 1 })
  graph.createNode('RECTANGLE', group.id, { x: 0, y: 0, width: 20, height: 20 })
  graph.createNode('ELLIPSE', group.id, { x: 100, y: 100, width: 50, height: 50, isMask: true })
  const masked = graph.createNode('RECTANGLE', group.id, { x: 50, y: 50, width: 200, height: 200 })

  fitEnclosingGroups(graph, [group.id])
  const bounds = () => {
    const { x, y, width, height } = graph.getNode(group.id) ?? group
    return { x, y, width, height }
  }
  expect(bounds()).toEqual({ x: 0, y: 0, width: 150, height: 150 })

  graph.updateNode(masked.id, { x: 300, y: 300 })
  fitEnclosingGroups(graph, [group.id])
  expect(bounds()).toEqual({ x: 0, y: 0, width: 150, height: 150 })
})
