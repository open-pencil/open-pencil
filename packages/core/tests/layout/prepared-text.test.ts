import { afterEach, describe, expect, test } from 'bun:test'

import { layOutPreparedText, setTextMeasurer } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

afterEach(() => setTextMeasurer(null))

describe('text laid out once its fonts are prepared', () => {
  test('lays out the frames around it but leaves an imported instance as its file saved it', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const fig = (id: string) => ({ ...page.source, format: 'fig' as const, id })
    const instance = graph.createNode('INSTANCE', page.id, {
      width: 300,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      source: fig('1:1')
    })
    const label = graph.createNode('FRAME', instance.id, {
      width: 10,
      height: 20,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      source: fig('1:2')
    })
    const text = graph.createNode('TEXT', label.id, {
      width: 10,
      height: 20,
      text: 'Category',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      source: fig('1:3')
    })
    // Where the file saved it, not where laying out the instance would put it.
    const icon = graph.createNode('RECTANGLE', instance.id, {
      x: 100,
      width: 16,
      height: 16,
      source: fig('1:4')
    })
    setTextMeasurer(() => ({ width: 50, height: 20 }))

    graph.applyDerivedLayoutDuring(() => layOutPreparedText(graph, [text.id]))

    expect(graph.getNode(text.id)?.width).toBe(50)
    expect(graph.getNode(label.id)?.width).toBe(50)
    expect(graph.getNode(icon.id)?.x).toBe(100)
  })
})
