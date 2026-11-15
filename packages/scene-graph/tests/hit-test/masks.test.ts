import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { maskRuns } from '@open-pencil/scene-graph/masks'
import { SOLID_FILL } from '@open-pencil/test-support/scene'

describe('mask runs', () => {
  const runsOf = (layers: string) => maskRuns([...layers], (layer) => layer === 'M')

  test('masks every sibling after them up to the next mask', () => {
    expect(runsOf('aMbcMd')).toEqual([
      { start: 1, maskedStart: 2, end: 4 },
      { start: 4, maskedStart: 5, end: 6 }
    ])
  })

  test('joins masks that follow one another, even with nothing to mask', () => {
    expect(runsOf('MMa')).toEqual([{ start: 0, maskedStart: 2, end: 3 }])
    expect(runsOf('aM')).toEqual([{ start: 1, maskedStart: 2, end: 2 }])
    expect(runsOf('ab')).toEqual([])
  })
})

// Figma desktop (2026-11-15): in a frame holding a layer, a 60px mask over it, and a 240px layer
// the mask holds, a click inside the mask takes the masked layer, and one where the mask cuts it
// away falls through to the layer below.
describe('clicks on masked layers', () => {
  function scene() {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, { x: 0, y: 0, width: 300, height: 300 })
    const below = graph.createNode('RECTANGLE', frame.id, {
      name: 'below',
      fills: [SOLID_FILL],
      x: 200,
      y: 200,
      width: 40,
      height: 40
    })
    const mask = graph.createNode('RECTANGLE', frame.id, {
      name: 'mask',
      fills: [SOLID_FILL],
      x: 20,
      y: 20,
      width: 60,
      height: 60,
      isMask: true
    })
    const masked = graph.createNode('RECTANGLE', frame.id, {
      name: 'masked',
      fills: [SOLID_FILL],
      x: 0,
      y: 0,
      width: 240,
      height: 240
    })
    return { graph, below, mask, masked }
  }

  test('take the masked layer inside its mask', () => {
    const { graph, masked } = scene()
    expect(graph.hitTestDeep(50, 50)?.id).toBe(masked.id)
  })

  test('fall through where the mask cuts the layer away', () => {
    const { graph, below } = scene()
    expect(graph.hitTestDeep(220, 220)?.id).toBe(below.id)
    expect(graph.hitTestDeep(150, 150)).toBeNull()
  })

  test('take the whole layer once its mask is hidden', () => {
    const { graph, mask, masked } = scene()
    graph.updateNode(mask.id, { visible: false })
    expect(graph.hitTestDeep(150, 150)?.id).toBe(masked.id)
  })

  test('hold a click to what a group mask draws, not the box around its layers', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, { x: 0, y: 0, width: 300, height: 300 })
    const mask = graph.createNode('GROUP', frame.id, {
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      isMask: true
    })
    for (const x of [0, 160]) {
      graph.createNode('RECTANGLE', mask.id, {
        fills: [SOLID_FILL],
        x,
        y: 0,
        width: 40,
        height: 40
      })
    }
    const masked = graph.createNode('RECTANGLE', frame.id, {
      fills: [SOLID_FILL],
      x: 0,
      y: 0,
      width: 240,
      height: 240
    })
    expect(graph.hitTestDeep(20, 20)?.id).toBe(masked.id)
    expect(graph.hitTestDeep(100, 20)).toBeNull()
  })
})
