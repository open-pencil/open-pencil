import { describe, expect, test } from 'bun:test'

import { applyCSSTransforms } from '#dom-css/import/scene-graph'

import { SceneGraph } from '@open-pencil/scene-graph'

describe('applying CSS transforms', () => {
  test('a layer a transform moves takes its grid parent out of grid layout', () => {
    const graph = new SceneGraph()
    const grid = graph.createNode('FRAME', graph.getPages()[0].id, {
      layoutMode: 'GRID',
      width: 100,
      height: 20
    })
    const moved = graph.createNode('FRAME', grid.id, { x: 0, width: 50, height: 20 })
    const still = graph.createNode('FRAME', grid.id, { x: 50, width: 50, height: 20 })

    applyCSSTransforms(graph, new Map([[moved.id, { translate: '5px 0' }]]))

    expect(grid.layoutMode).toBe('NONE')
    expect([moved.x, still.x]).toEqual([5, 50])
  })

  test('a turn about the center keeps the grid', () => {
    const graph = new SceneGraph()
    const grid = graph.createNode('FRAME', graph.getPages()[0].id, { layoutMode: 'GRID' })
    const turned = graph.createNode('FRAME', grid.id, { width: 50, height: 20 })

    applyCSSTransforms(graph, new Map([[turned.id, { rotate: '45deg' }]]))

    expect(grid.layoutMode).toBe('GRID')
    expect(turned.rotation).toBeCloseTo(45)
  })
})
