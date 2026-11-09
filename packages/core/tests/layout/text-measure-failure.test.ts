import { describe, expect, test } from 'bun:test'

import { autoFrame, pageId } from '#core-tests/helpers/layout'

import { installTextMeasurer, computeLayout } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

describe('layout text measurement', () => {
  test('a failing measurement keeps the text size and does not break later layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph))
    const text = graph.createNode('TEXT', frame.id, {
      text: 'Hello',
      width: 64,
      height: 24,
      fontSize: 16,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })

    const uninstall = installTextMeasurer(() => {
      throw new Error('measurement failed')
    })
    try {
      // Yoga calls the measurer from WASM, and an exception that crosses its frames leaves the
      // WASM stack pointer un-restored; repeating the failed layout must stay harmless.
      for (let attempt = 0; attempt < 400; attempt++) computeLayout(graph, frame.id)
    } finally {
      uninstall()
    }

    const measured = getNodeOrThrow(graph, text.id)
    expect(measured.width).toBe(64)
    expect(measured.height).toBe(24)

    computeLayout(graph, frame.id)
    expect(getNodeOrThrow(graph, frame.id).height).toBe(200)
  })
})
