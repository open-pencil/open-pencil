import { afterEach, describe, expect, test } from 'bun:test'

import { computeAllLayouts, setTextMeasurer } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

const TEXT = 'Twenty characters!!!'

/** 10px a character on one line; a narrower width wraps it onto lines 20px tall. */
function measureByLength() {
  setTextMeasurer((node, maxWidth) => {
    const width = (node.text?.length ?? 0) * 10
    if (maxWidth !== undefined && width > maxWidth) {
      return { width: maxWidth, height: 20 * Math.ceil(width / maxWidth) }
    }
    return { width, height: 20 }
  })
}

function size(graph: SceneGraph, id: string) {
  const node = graph.getNode(id)
  return { width: node?.width, height: node?.height }
}

function frame(graph: SceneGraph, layoutMode: 'HORIZONTAL' | 'VERTICAL', width: number) {
  return graph.createNode('FRAME', graph.getPages()[0].id, {
    layoutMode,
    width,
    height: 100,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
}

afterEach(() => setTextMeasurer(null))

// `@figma/plugin-typings` on textAutoResize: in WIDTH_AND_HEIGHT, "Characters do not wrap."
describe('auto-width text in an auto layout frame narrower than the text', () => {
  test.each(['HORIZONTAL', 'VERTICAL'] as const)('keeps its line whole in a %s frame', (mode) => {
    measureByLength()
    const graph = new SceneGraph()
    const parent = frame(graph, mode, 100)
    const text = graph.createNode('TEXT', parent.id, {
      text: TEXT,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })

    computeAllLayouts(graph)

    expect(size(graph, text.id)).toEqual({ width: 200, height: 20 })
  })

  test('wraps where layout stretches it across a column', () => {
    measureByLength()
    const graph = new SceneGraph()
    const column = frame(graph, 'VERTICAL', 100)
    const text = graph.createNode('TEXT', column.id, {
      text: TEXT,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      layoutAlignSelf: 'STRETCH'
    })

    computeAllLayouts(graph)

    expect(size(graph, text.id)).toEqual({ width: 100, height: 40 })
  })

  test('wraps at its max width', () => {
    measureByLength()
    const graph = new SceneGraph()
    const row = frame(graph, 'HORIZONTAL', 300)
    const text = graph.createNode('TEXT', row.id, {
      text: TEXT,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      maxWidth: 120
    })

    computeAllLayouts(graph)

    expect(size(graph, text.id)).toEqual({ width: 120, height: 40 })
  })
})
