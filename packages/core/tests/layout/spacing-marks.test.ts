import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { flowGaps, paddingRect, paddingTick } from '#core/layout/spacing-marks'

// Figma desktop (2026-11-14), a 200×160 row with 80px of top padding and none below: the gap's
// tick sits in the middle of the content box, 120px down, not in the frame's middle.
function row() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, {
    width: 200,
    height: 160,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 40,
    paddingTop: 80
  })
  graph.createNode('RECTANGLE', frame.id, { x: 0, y: 80, width: 80, height: 80 })
  graph.createNode('RECTANGLE', frame.id, { x: 120, y: 80, width: 80, height: 80 })
  graph.createNode('RECTANGLE', frame.id, { x: 0, y: 0, width: 10, height: 10, visible: false })
  return { graph, frame: graph.getNode(frame.id) ?? frame }
}

describe('auto layout spacing marks', () => {
  test("a gap spans the content box and its tick sits in the content box's middle", () => {
    const { graph, frame } = row()
    expect(flowGaps(frame, graph)).toEqual([
      { index: 0, rect: { x: 80, y: 80, width: 40, height: 80 }, tick: { x: 100, y: 120 } }
    ])
  })

  test("a padding's tick sits in the middle of its band, across from the frame's middle", () => {
    const { frame } = row()
    expect(paddingRect(frame, 'top')).toEqual({ x: 0, y: 0, width: 200, height: 80 })
    expect(paddingTick(frame, 'top')).toEqual({ x: 100, y: 40 })
  })

  test('layers with no room between them leave no gap', () => {
    const { graph, frame } = row()
    const [, second] = frame.childIds
    graph.updateNode(second, { x: 80 })
    expect(flowGaps(frame, graph)).toEqual([])
  })
})
