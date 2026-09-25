import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'

import { canvas, doc, node } from '../helpers'

describe('fig-import: node types', () => {
  test('ROUNDED_RECTANGLE imported as its own type', () => {
    const graph = materializeDocument([doc(), canvas(), node('ROUNDED_RECTANGLE', 10, 1)]).graph
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('ROUNDED_RECTANGLE')
  })

  test('COMPONENT maps to COMPONENT', () => {
    const graph = materializeDocument([doc(), canvas(), node('COMPONENT', 10, 1)]).graph
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('COMPONENT')
  })

  test('INSTANCE maps to INSTANCE', () => {
    const graph = materializeDocument([doc(), canvas(), node('INSTANCE', 10, 1)]).graph
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('INSTANCE')
  })

  test('SYMBOL maps to COMPONENT', () => {
    const graph = materializeDocument([doc(), canvas(), node('SYMBOL', 10, 1)]).graph
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('COMPONENT')
  })

  test('REGULAR_POLYGON maps to POLYGON', () => {
    const graph = materializeDocument([doc(), canvas(), node('REGULAR_POLYGON', 10, 1)]).graph
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('POLYGON')
  })
})
