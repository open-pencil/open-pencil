import { describe, expect, test } from 'bun:test'

import { jsxNodeFields, parseJSXAttributes } from '#design-jsx/index'

import { SceneGraph } from '@open-pencil/scene-graph'

function fields(graph: SceneGraph, type: 'FRAME' | 'TEXT', source: string) {
  return jsxNodeFields(graph, type, parseJSXAttributes(source), graph.getPages()[0].id)
}

describe('jsxNodeFields', () => {
  test('sets what the attributes describe and defaults the rest, without creating a node', () => {
    const graph = new SceneGraph()
    const count = graph.nodes.size
    const { fields: result } = fields(graph, 'FRAME', 'w={240} rounded={12} opacity={0.5}')
    expect(result).toMatchObject({ width: 240, cornerRadius: 12, opacity: 0.5, visible: true })
    expect(fields(graph, 'FRAME', 'w={240}').fields.cornerRadius).toBe(0)
    expect(graph.nodes.size).toBe(count)
  })

  test('reads text from the text attribute', () => {
    const graph = new SceneGraph()
    expect(fields(graph, 'TEXT', 'text="Hi"').fields.text).toBe('Hi')
  })

  test('resolves variables to bindings', () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Tokens')
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
    expect(fields(graph, 'FRAME', 'bg={designVar("Brand")}').bindings).toEqual({
      'fills/0/color': brand.id
    })
  })
})
