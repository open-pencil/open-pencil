import { expect, test } from 'bun:test'

import { applyDocumentPaintBindings } from '#fig/document/bindings/paint'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

const BLACK_FILL: Fill = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 0.5,
  visible: true,
  blendMode: 'NORMAL'
}

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Colors')
  const accent = graph.createVariable('Accent', 'COLOR', collection.id, {
    r: 1,
    g: 1,
    b: 1,
    a: 0.2
  })
  const boundFill = { fills: [BLACK_FILL], boundVariables: { 'fills/0/color': accent.id } }
  const layer = graph.createNode('RECTANGLE', page, boundFill)
  const instance = graph.createNode('INSTANCE', page)
  const copy = graph.createNode('RECTANGLE', instance.id, boundFill)
  return { graph, layer, instance, copy }
}

// Figma saves a bound paint's color and opacity as the cache it draws, edits included.
test("a layer's bound paint stays as saved", () => {
  const { graph, layer } = setup()
  applyDocumentPaintBindings(graph, [layer])
  expect(layer.fills[0].color).toEqual(BLACK_FILL.color)
  expect(layer.fills[0].opacity).toBe(0.5)
})

// A copy shows its variables in its instance's context, its alpha as the paint's opacity.
// Figma refreshes it only once the color its variable gives the layer changes.
test('a saved bound paint stays through a reconcile until its variable changes', () => {
  const { graph, layer } = setup()
  applyDocumentPaintBindings(graph, [layer])
  const accent = layer.boundVariables['fills/0/color']
  reconcileVariableBindings(graph, { variables: [accent] })
  expect(layer.fills[0].opacity).toBe(0.5)
  const variable = graph.variables.get(accent)
  if (!variable) throw new Error('accent')
  variable.valuesByMode[Object.keys(variable.valuesByMode)[0]] = { r: 0, g: 1, b: 0, a: 1 }
  reconcileVariableBindings(graph, { variables: [accent] })
  expect(layer.fills[0].color).toEqual({ r: 0, g: 1, b: 0, a: 1 })
  expect(layer.fills[0].opacity).toBe(1)
})

test("an instance's copy takes its variable's color", () => {
  const { graph, copy } = setup()
  applyDocumentPaintBindings(graph, [copy])
  expect(copy.fills[0].color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
  expect(copy.fills[0].opacity).toBeCloseTo(0.2)
})

test('a copy whose fills the instance overrides keeps them as saved', () => {
  const { graph, instance, copy } = setup()
  setInstanceOverride(instance.instanceOverrides, instance.id, copy.id, 'fills', copy.fills)
  applyDocumentPaintBindings(graph, [copy])
  expect(copy.fills[0].color).toEqual(BLACK_FILL.color)
  expect(copy.fills[0].opacity).toBe(0.5)
})
