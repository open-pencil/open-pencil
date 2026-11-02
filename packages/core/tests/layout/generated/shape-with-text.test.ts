import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { computeAllLayouts, setTextMeasurer } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createShapeWithText, shapeWithTextLabel } from '@open-pencil/scene-graph/generated'

/** One 36 px line per line break, 12 px a character, never wrapping. */
beforeEach(() =>
  setTextMeasurer((node, maxWidth) => {
    const lines = node.text.split('\n')
    const widest = Math.max(...lines.map((line) => line.length * 12))
    return { width: Math.min(maxWidth ?? widest, widest), height: lines.length * 36 }
  })
)
afterEach(() => setTextMeasurer(null))

function drawnShape(graph: SceneGraph, text = 'Hi') {
  const shape = createShapeWithText(graph, graph.getPages()[0].id, {}, { text })
  computeAllLayouts(graph, shape.id)
  return shape.id
}

describe('shape with text size', () => {
  test('a resize previewed during a drag is the size layout keeps', () => {
    const graph = new SceneGraph()
    const id = drawnShape(graph)
    graph.updateNodePreview(id, { width: 400, height: 300 })
    graph.runPreviewUpdates(() => computeAllLayouts(graph, id))
    expect(getNodeOrThrow(graph, id)).toMatchObject({ width: 400, height: 300 })
  })

  test('putting the size back, as an undo or a cancelled drag does, shrinks it again', () => {
    const graph = new SceneGraph()
    const id = drawnShape(graph)
    graph.updateNode(id, { width: 400, height: 300 })
    computeAllLayouts(graph, id)
    graph.updateNode(id, { width: 176, height: 176 })
    computeAllLayouts(graph, id)
    expect(getNodeOrThrow(graph, id)).toMatchObject({ width: 176, height: 176 })
  })

  test('growing for its label leaves the given size, so a shorter label shrinks it back', () => {
    const graph = new SceneGraph()
    const id = drawnShape(graph)
    const label = shapeWithTextLabel(graph, getNodeOrThrow(graph, id))
    if (!label) throw new Error('shape has no label')
    graph.updateNode(label.id, { text: Array.from({ length: 8 }, () => 'line').join('\n') })
    computeAllLayouts(graph, id)
    const grown = getNodeOrThrow(graph, id)
    expect(grown.height).toBeGreaterThan(176)
    expect(grown.shapeUserHeight).toBe(176)
    graph.updateNode(label.id, { text: 'Hi' })
    computeAllLayouts(graph, id)
    expect(getNodeOrThrow(graph, id).height).toBe(176)
  })

  test('a long label grows the shape taller only, as FigJam grows it', () => {
    const graph = new SceneGraph()
    const id = drawnShape(graph, 'Internationalisation in a label')
    // The 372 px line is wider than the 144 px label box, so it wraps, and the shape stays 176 wide.
    expect(getNodeOrThrow(graph, id).width).toBe(176)
  })

  test('a shape whose height was set keeps it and cuts its label off', () => {
    const graph = new SceneGraph()
    const id = drawnShape(graph)
    graph.updateNode(id, { height: 120 })
    const label = shapeWithTextLabel(graph, getNodeOrThrow(graph, id))
    if (!label) throw new Error('shape has no label')
    graph.updateNode(label.id, { text: Array.from({ length: 8 }, () => 'line').join('\n') })
    computeAllLayouts(graph, id)
    expect(getNodeOrThrow(graph, id)).toMatchObject({ height: 120, shapeTruncates: true })
    // Cut to the 88 px label box, which the renderer fills with whole lines and "…".
    expect(getNodeOrThrow(graph, label.id)).toMatchObject({
      textTruncation: 'ENDING',
      height: 88
    })
    graph.updateNode(label.id, { text: 'Hi' })
    computeAllLayouts(graph, id)
    expect(getNodeOrThrow(graph, label.id)).toMatchObject({
      textTruncation: 'DISABLED',
      textAutoResize: 'HEIGHT'
    })
  })

  test('a truncated label stays truncated however often layout runs', () => {
    // As CanvasKit measures, a truncated label measures only the lines it shows.
    setTextMeasurer((node) => {
      const lines = node.text.split('\n').length
      const shown = node.textTruncation === 'ENDING' ? Math.floor(node.height / 36) : lines
      return { width: 40, height: Math.min(lines, shown) * 36 }
    })
    const graph = new SceneGraph()
    const id = drawnShape(graph)
    graph.updateNode(id, { height: 120 })
    const label = shapeWithTextLabel(graph, getNodeOrThrow(graph, id))
    if (!label) throw new Error('shape has no label')
    graph.updateNode(label.id, { text: Array.from({ length: 8 }, () => 'line').join('\n') })
    for (let pass = 0; pass < 3; pass++) {
      computeAllLayouts(graph, id)
      expect(getNodeOrThrow(graph, label.id).textTruncation).toBe('ENDING')
    }
  })
})
