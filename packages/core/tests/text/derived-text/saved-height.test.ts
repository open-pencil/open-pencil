import { expect, test } from 'bun:test'

import { computeAllLayouts, getTextMeasurer, setTextMeasurer } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

test('saved glyph height wins over a different font measurer at unchanged width', () => {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    width: 878,
    height: 200,
    layoutMode: 'VERTICAL'
  })
  const text = graph.createNode('TEXT', frame.id, {
    width: 878,
    height: 60,
    text: 'Saved text',
    textAutoResize: 'HEIGHT',
    derivedTextGlyphs: [{ commandsBlob: new Uint8Array([0]), x: 0, y: 20, fontSize: 20 }]
  })
  const previous = getTextMeasurer()
  setTextMeasurer(() => ({ width: 878, height: 90 }))
  try {
    computeAllLayouts(graph)
    expect(text.height).toBe(60)
    expect(text.derivedTextGlyphs).toHaveLength(1)
    graph.updateNode(text.id, { width: 800 })
    computeAllLayouts(graph)
    expect(text.height).toBe(90)
    expect(text.derivedTextGlyphs).toBeNull()
  } finally {
    setTextMeasurer(previous)
  }
})
