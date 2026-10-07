import { afterEach, describe, expect, test } from 'bun:test'

import { computeAllLayouts, SceneGraph, setTextMeasurer } from '@open-pencil/core'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** Fixed-width text that wraps to its width and grows to fill its share of the parent. */
function fillText(graph: SceneGraph, parentId: string, text: string) {
  return graph.createNode('TEXT', parentId, {
    name: text,
    text,
    fontSize: 12,
    textAutoResize: 'HEIGHT',
    layoutGrow: 1
  })
}

function row(graph: SceneGraph, width: number) {
  return graph.createNode('FRAME', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    width,
    height: 20,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    itemSpacing: 2
  })
}

afterEach(() => setTextMeasurer(null))

// Fill text starts at the default 100px width, so its stored width must not become its basis.
describe.each([
  ['with a text measurer', () => setTextMeasurer(() => ({ width: 15, height: 16 }))],
  ['without a text measurer', () => setTextMeasurer(null)]
])('fill text %s', (_, useMeasurer) => {
  test('shares a fixed row evenly, like fill frames', () => {
    useMeasurer()
    const graph = new SceneGraph()
    const week = row(graph, 280)
    const labels = DAYS.map((day) => fillText(graph, week.id, day))

    computeAllLayouts(graph)

    const share = (280 - 6 * 2) / 7
    for (const [index, label] of labels.entries()) {
      expect(label.width).toBeCloseTo(share, 3)
      expect(label.x).toBeCloseTo(index * (share + 2), 3)
    }
  })

  test('takes the space a fixed sibling leaves', () => {
    useMeasurer()
    const graph = new SceneGraph()
    const header = row(graph, 200)
    graph.createNode('FRAME', header.id, { width: 40, height: 20 })
    const title = fillText(graph, header.id, 'March 2025')

    computeAllLayouts(graph)

    expect(title.width).toBeCloseTo(200 - 40 - 2, 3)
    expect(title.x).toBeCloseTo(42, 3)
  })
})
