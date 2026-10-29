import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { computeAllLayouts, setTextMeasurer } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createSticky, stickySublayers } from '@open-pencil/scene-graph/generated'
import { lineHeightPixels } from '@open-pencil/scene-graph/text'

/** One line per line break, each as tall as the text's line height. */
function measureLines(): void {
  setTextMeasurer((node, maxWidth) => ({
    width: maxWidth ?? node.width,
    height:
      node.text.split('\n').length *
      (lineHeightPixels(node.lineHeight, node.fontSize) ?? node.fontSize)
  }))
}

function lines(count: number): string {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`).join('\n')
}

beforeEach(measureLines)
afterEach(() => setTextMeasurer(null))

// Sizes measured in FigJam: a note keeps its width and grows to its text, author at the bottom.
describe('sticky note layout', () => {
  test('a short note keeps its square and pins the author to the bottom', () => {
    const graph = new SceneGraph()
    const note = createSticky(graph, graph.getPages()[0].id, { text: 'Hello', author: 'Ada' })
    computeAllLayouts(graph)
    const { body, author } = expectDefined(stickySublayers(graph, note))
    expect([note.width, note.height]).toEqual([240, 240])
    expect([body.x, body.y, body.width, body.height]).toEqual([20, 20, 200, 24])
    expect([author.x, author.y, author.height]).toEqual([20, 204, 16])
  })

  test('long text grows the note downwards', () => {
    const graph = new SceneGraph()
    const note = createSticky(graph, graph.getPages()[0].id, { text: lines(16), author: 'Ada' })
    computeAllLayouts(graph)
    const { author } = expectDefined(stickySublayers(graph, note))
    expect([note.width, note.height]).toEqual([240, 456])
    expect(author.y).toBe(420)
  })

  test('a hidden author gives its space back to the text', () => {
    const graph = new SceneGraph()
    const note = createSticky(graph, graph.getPages()[0].id, {
      text: lines(16),
      author: 'Ada',
      authorVisible: false
    })
    computeAllLayouts(graph)
    expect(note.height).toBe(424)
  })

  test('a wide or rescaled note scales its padding and minimum', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const wide = createSticky(graph, page, { text: 'Wide', author: 'Ada', wide: true })
    const scaled = createSticky(graph, page, { text: 'Scaled', author: 'Ada', scale: 1.5 })
    computeAllLayouts(graph)
    expect([wide.width, wide.height]).toEqual([416, 240])
    expect(expectDefined(stickySublayers(graph, wide)).body.width).toBe(376)
    expect([scaled.width, scaled.height]).toEqual([360, 360])
    const { body, author } = expectDefined(stickySublayers(graph, scaled))
    expect([body.x, body.y, body.width, body.height]).toEqual([30, 30, 300, 36])
    expect([author.y, author.fontSize]).toEqual([306, 18])
  })
})
