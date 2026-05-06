import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('counterAxisAlignContent', () => {
  test('SPACE_BETWEEN distributes wrapped rows evenly', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 300,
      layoutWrap: 'WRAP',
      counterAxisAlignContent: 'SPACE_BETWEEN' as const
    })
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    // 3 rows of 40px each = 120px total, 300 - 120 = 180px free space
    // SPACE_BETWEEN: first row at 0, last row at 260
    expect(children[0].y).toBe(0)
    expect(children[2].y).toBe(260)
    // Middle row centered: (0 + 260) / 2 = 130
    expect(children[1].y).toBe(130)
  })

  test('AUTO (default) packs wrapped rows at start', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 300,
      layoutWrap: 'WRAP'
    })
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(0)
    expect(children[1].y).toBe(40)
    expect(children[2].y).toBe(80)
  })
})
