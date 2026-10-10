import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'

function text() {
  const graph = new SceneGraph()
  const node = new FigmaAPI(graph).createText()
  node.fontSize = 20
  return { graph, node }
}

// Figma's plugin API reads and writes line height and letter spacing as { unit, value }. Scripts
// written for Figma assigned those objects straight onto the node, which left the text
// unmeasured and undrawn.
describe('text units in the plugin API', () => {
  test('line height takes pixels, percent of the font size, and auto', () => {
    const { graph, node } = text()
    node.lineHeight = { unit: 'PIXELS', value: 22 }
    expect(expectDefined(graph.getNode(node.id)).lineHeight).toBe(22)
    expect(node.lineHeight).toEqual({ unit: 'PIXELS', value: 22 })

    node.lineHeight = { unit: 'PERCENT', value: 150 }
    expect(expectDefined(graph.getNode(node.id)).lineHeight).toBe(30)

    node.lineHeight = { unit: 'AUTO' }
    expect(expectDefined(graph.getNode(node.id)).lineHeight).toBeNull()
    expect(node.lineHeight).toEqual({ unit: 'AUTO' })
  })

  test('letter spacing takes pixels and percent of the font size', () => {
    const { graph, node } = text()
    node.letterSpacing = { unit: 'PERCENT', value: 10 }
    expect(expectDefined(graph.getNode(node.id)).letterSpacing).toBe(2)
    expect(node.letterSpacing).toEqual({ unit: 'PIXELS', value: 2 })
  })

  // Plugin typings allow only the object; untyped eval scripts may still pass a number.
  test('a bare number still sets pixels and null automatic, as earlier OpenPencil scripts wrote them', () => {
    const { graph, node } = text()
    Reflect.set(node, 'lineHeight', 18)
    Reflect.set(node, 'letterSpacing', 1)
    expect(expectDefined(graph.getNode(node.id))).toMatchObject({
      lineHeight: 18,
      letterSpacing: 1
    })
  })
})
