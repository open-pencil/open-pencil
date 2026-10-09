import { afterEach, describe, expect, test } from 'bun:test'

import { layoutAuthoredNodes, setTextMeasurer } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

afterEach(() => setTextMeasurer(null))

function measureByLength() {
  setTextMeasurer((node, maxWidth) => {
    const width = (node.text?.length ?? 0) * 10
    if (maxWidth && width > maxWidth) return { width: maxWidth, height: 40 }
    return { width, height: 20 }
  })
}

describe('laying out authored content', () => {
  test('text that resizes to its content is measured outside auto layout too', () => {
    measureByLength()
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, { width: 300, height: 200 })
    const hugging = graph.createNode('TEXT', frame.id, {
      text: 'Hello',
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const wrapping = graph.createNode('TEXT', frame.id, {
      text: 'A longer line',
      width: 60,
      textAutoResize: 'HEIGHT'
    })
    const fixed = graph.createNode('TEXT', frame.id, { text: 'Fixed', textAutoResize: 'NONE' })

    layoutAuthoredNodes(graph, [frame.id])

    expect(graph.getNode(hugging.id)).toMatchObject({ width: 50, height: 20 })
    expect(graph.getNode(wrapping.id)).toMatchObject({ width: 60, height: 40 })
    expect(graph.getNode(fixed.id)).toMatchObject({ width: 100, height: 100 })
  })

  test('wrapping text that layout stretches takes the height of its lines', () => {
    // No measurer, as headless tools run: layout alone would keep the height of one line.
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const column = graph.createNode('FRAME', page, {
      layoutMode: 'VERTICAL',
      width: 200,
      primaryAxisSizing: 'HUG'
    })
    const text = graph.createNode('TEXT', column.id, {
      text: 'A paragraph long enough to wrap across several lines of the column',
      fontSize: 14,
      width: 0,
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH'
    })
    layoutAuthoredNodes(graph, [column.id])

    const laidOut = graph.getNode(text.id)
    expect(laidOut?.width).toBe(200)
    expect(laidOut?.height).toBeGreaterThan(2 * 14 * 1.4)
    expect(graph.getNode(column.id)?.height).toBe(laidOut?.height)
  })

  test('auto layout places the roots it is given', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const stack = graph.createNode('FRAME', page, {
      layoutMode: 'VERTICAL',
      paddingTop: 24,
      paddingLeft: 24,
      itemSpacing: 16,
      width: 200,
      height: 400
    })
    const first = graph.createNode('FRAME', stack.id, { width: 50, height: 50 })
    const second = graph.createNode('FRAME', stack.id, { width: 50, height: 50 })

    layoutAuthoredNodes(graph, [stack.id])

    expect(graph.getNode(first.id)).toMatchObject({ x: 24, y: 24 })
    expect(graph.getNode(second.id)).toMatchObject({ x: 24, y: 90 })
  })
})
