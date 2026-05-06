import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('gap mapping correctness', () => {
  test('horizontal: itemSpacing is column gap, counterAxisSpacing is row gap', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 300,
      layoutWrap: 'WRAP',
      itemSpacing: 10,
      counterAxisSpacing: 20
    })
    // Each row: 90 + 10 + 90 = 190 <= 200
    rect(graph, frame.id, 90, 40)
    rect(graph, frame.id, 90, 40)
    // These wrap
    rect(graph, frame.id, 90, 40)
    rect(graph, frame.id, 90, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    // Row 1
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(100)
    // Row 2: y = 40 (row height) + 20 (counterAxisSpacing) = 60
    expect(children[2].y).toBe(60)
    expect(children[3].x).toBe(100)
  })

  test('vertical: itemSpacing is row gap, counterAxisSpacing is column gap', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 300,
      height: 200,
      layoutWrap: 'WRAP',
      itemSpacing: 10,
      counterAxisSpacing: 20
    })
    // Each column: 80 + 10 + 80 = 170 <= 200
    rect(graph, frame.id, 40, 80)
    rect(graph, frame.id, 40, 80)
    // These wrap to second column
    rect(graph, frame.id, 40, 80)
    rect(graph, frame.id, 40, 80)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    // Column 1
    expect(children[0].y).toBe(0)
    expect(children[1].y).toBe(90)
    // Column 2: x = 40 (col width) + 20 (counterAxisSpacing) = 60
    expect(children[2].x).toBe(60)
    expect(children[2].y).toBe(0)
    expect(children[3].x).toBe(60)
    expect(children[3].y).toBe(90)
  })
})
