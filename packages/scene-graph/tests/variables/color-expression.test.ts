import { expect, test } from 'bun:test'

import {
  SceneGraph,
  mapVariableValueReferences,
  variablesResolvingThrough,
  type VariableValue
} from '@open-pencil/scene-graph'

function setup() {
  const graph = new SceneGraph()
  const colors = graph.createCollection('Colors')
  const opacity = graph.createCollection('Opacity')
  const base = graph.createVariable('Base', 'COLOR', colors.id, { r: 1, g: 0, b: 0, a: 1 })
  const amount = graph.createVariable('Amount', 'FLOAT', opacity.id, 20)
  const value: VariableValue = {
    expression: 'COMPOSE_COLOR',
    color: { aliasId: base.id },
    opacity: { aliasId: amount.id }
  }
  const derived = graph.createVariable('Derived', 'COLOR', colors.id, value)
  return { graph, colors, opacity, base, amount, derived }
}

test('derived colors retain both dependencies and follow base and opacity edits', () => {
  const { graph, colors, opacity, base, amount, derived } = setup()
  expect(graph.resolveColorVariable(derived.id)).toEqual({ r: 1, g: 0, b: 0, a: 0.2 })
  base.valuesByMode[colors.defaultModeId] = { r: 0, g: 0, b: 1, a: 1 }
  amount.valuesByMode[opacity.defaultModeId] = 70
  expect(graph.resolveColorVariable(derived.id)).toEqual({ r: 0, g: 0, b: 1, a: 0.7 })
  expect(variablesResolvingThrough(graph, [base.id]).has(derived.id)).toBe(true)
  expect(variablesResolvingThrough(graph, [amount.id]).has(derived.id)).toBe(true)
  expect(derived.valuesByMode[colors.defaultModeId]).toEqual({
    expression: 'COMPOSE_COLOR',
    color: { aliasId: base.id },
    opacity: { aliasId: amount.id }
  })
})

test('each operand follows its collection mode, including inherited node modes', () => {
  const { graph, colors, opacity, base, amount, derived } = setup()
  graph.addMode(colors.id, 'night', 'Night')
  graph.addMode(opacity.id, 'strong', 'Strong')
  base.valuesByMode.night = { r: 0, g: 0, b: 1, a: 1 }
  amount.valuesByMode.strong = 80
  graph.setActiveMode(opacity.id, 'strong')
  expect(graph.resolveVariable(derived.id, 'night')).toEqual({ r: 0, g: 0, b: 1, a: 0.8 })
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    variableModes: { [colors.id]: 'night', [opacity.id]: 'strong' }
  })
  const node = graph.createNode('RECTANGLE', frame.id)
  expect(graph.resolveColorVariableForNode(node.id, derived.id, 'default')).toEqual({
    r: 0,
    g: 0,
    b: 1,
    a: 0.8
  })
})

test('cycles, missing dependencies, wrong types and nonfinite values stay unresolved', () => {
  const { graph, colors, opacity, base, amount, derived } = setup()
  base.valuesByMode[colors.defaultModeId] = { aliasId: derived.id }
  expect(graph.resolveColorVariable(derived.id)).toBeUndefined()
  base.valuesByMode[colors.defaultModeId] = 'red'
  expect(graph.resolveColorVariable(derived.id)).toBeUndefined()
  base.valuesByMode[colors.defaultModeId] = { r: 1, g: 0, b: 0, a: 1 }
  amount.valuesByMode[opacity.defaultModeId] = Infinity
  expect(graph.resolveColorVariable(derived.id)).toBeUndefined()
  amount.valuesByMode[opacity.defaultModeId] = 0
  expect(graph.resolveColorVariable(derived.id)?.a).toBe(0)
  graph.removeVariable(base.id)
  expect(graph.resolveColorVariable(derived.id)).toBeUndefined()
})

test('transfer remaps both references without changing the source definition', () => {
  const { colors, base, amount, derived } = setup()
  const value = derived.valuesByMode[colors.defaultModeId]
  expect(mapVariableValueReferences(value, (id) => `copy:${id}`)).toEqual({
    expression: 'COMPOSE_COLOR',
    color: { aliasId: `copy:${base.id}` },
    opacity: { aliasId: `copy:${amount.id}` }
  })
  expect(value).toEqual({
    expression: 'COMPOSE_COLOR',
    color: { aliasId: base.id },
    opacity: { aliasId: amount.id }
  })
})
