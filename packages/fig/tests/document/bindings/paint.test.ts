import { expect, test } from 'bun:test'

import { applyDocumentPaintBindings } from '#fig/document/bindings/paint'

import { SceneGraph } from '@open-pencil/scene-graph'

function setup(alpha: number, opacity: number) {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Colors')
  const variable = graph.createVariable('Accent', 'COLOR', collection.id, {
    r: 1,
    g: 1,
    b: 1,
    a: alpha
  })
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity, visible: true }],
    boundVariables: { 'fills/0/color': variable.id }
  })
  return { graph, node }
}

/** Drawing takes a solid fill's alpha from its opacity, so the variable has to own it. */
test('a bound fill takes its alpha from the variable, not the paint', () => {
  const { graph, node } = setup(0.2, 1)
  applyDocumentPaintBindings(graph, [node])
  expect(node.fills[0].color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
  expect(node.fills[0].opacity).toBeCloseTo(0.2)
})

/** An opacity left over from an override the binding supersedes must not survive. */
test('a bound fill replaces a stale opacity rather than combining with it', () => {
  const { graph, node } = setup(1, 0.5)
  applyDocumentPaintBindings(graph, [node])
  expect(node.fills[0].opacity).toBe(1)
})

test('a bound stroke follows the same rule', () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Colors')
  const variable = graph.createVariable('Line', 'COLOR', collection.id, {
    r: 0,
    g: 0,
    b: 0,
    a: 0.4
  })
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    strokes: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    boundVariables: { 'strokes/0/color': variable.id }
  })
  applyDocumentPaintBindings(graph, [node])
  expect(node.strokes[0].color).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  expect(node.strokes[0].opacity).toBeCloseTo(0.4)
})
