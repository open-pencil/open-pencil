import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('self-alignment', () => {
  test('layoutAlignSelf STRETCH overrides counter axis', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'MIN'
    })
    rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'STRETCH' })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].height).toBe(200)
    expect(children[1].height).toBe(50)
  })
})
