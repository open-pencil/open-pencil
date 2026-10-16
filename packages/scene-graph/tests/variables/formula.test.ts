import { expect, test, spyOn } from 'bun:test'

import jsep from 'jsep'
import * as v from 'valibot'

import {
  SceneGraph,
  parseVariableFormula,
  formatVariableFormula,
  variableValueReferences,
  mapVariableValueReferences,
  variableFormulaSchema,
  collectionsBoundIn,
  type VariableFormulaNode,
  type VariableValue
} from '@open-pencil/scene-graph'
import { createBatchVariableResolver } from '@open-pencil/scene-graph/variables'

function setup(type: 'FLOAT' | 'BOOLEAN' = 'FLOAT') {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const base = graph.createVariable('base', type, collection.id, type === 'FLOAT' ? 4 : true)
  const derived = graph.createVariable('derived', type, collection.id, type === 'FLOAT' ? 0 : false)
  const mode = collection.defaultModeId
  const parse = (source: string) => parseVariableFormula(graph, derived.id, mode, source)
  const set = (source: string) => {
    derived.valuesByMode[mode] = parse(source).value
  }
  return { graph, collection, base, derived, mode, parse, set }
}

test('arithmetic, precedence, unary signs, references and renaming', () => {
  const { graph, base, derived, mode, parse, set } = setup()
  expect(parse('{base} * 2 + 3 / (2 + 1)').resolved).toBe(9)
  expect(parse('-{base} + +2').resolved).toBe(-2)
  expect(parse('1e3 / 2').resolved).toBe(500)
  set('{base} * 2')
  base.name = 'renamed'
  expect(graph.resolveVariable(derived.id)).toBe(8)
  expect(formatVariableFormula(graph, derived.valuesByMode[mode])).toContain('{Tokens::renamed}')
  base.valuesByMode[mode] = 6
  expect(graph.resolveVariable(derived.id)).toBe(12)
})

test.each([
  ['true AND false', false],
  ['true OR false', true],
  ['NOT true', false],
  ['true XOR true', false],
  ['true XOR false', true],
  ['true NAND true', false],
  ['false NOR false', true],
  ['true NOR false', false],
  ['true OR true AND false', true],
  ['NOT ({base} AND false)', true]
] as const)('Boolean logic %s', (source, expected) => {
  const { parse } = setup('BOOLEAN')
  expect(parse(source).resolved).toBe(expected)
})

test('invalid drafts keep the saved definition intact and restore the shared parser grammar', () => {
  const { parse, derived, mode } = setup()
  const operators = { ...jsep.binary_ops }
  for (const source of [
    '{missing} * 2',
    '{derived} + 1',
    '1 / 0',
    '1e308 * 1e308',
    'true + 1',
    'true',
    'Math.random()',
    '({base}).value',
    '[1,2]',
    '1;2',
    '1 ** 2',
    'a = 3',
    '$reference0 + {base}',
    '('.repeat(10000)
  ])
    expect(() => parse(source)).toThrow()
  expect(derived.valuesByMode[mode]).toBe(0)
  expect(jsep.binary_ops).toEqual(operators)
})

test('cycles through other formulas are rejected even in Boolean branches that would short circuit', () => {
  const { base, derived, mode, parse } = setup('BOOLEAN')
  base.valuesByMode[mode] = { aliasId: derived.id }
  expect(() => parse('false AND {base}')).toThrow('Circular')
})

test.each([
  [false, false, false, false, false, true, true],
  [false, true, false, true, true, true, false],
  [true, false, false, true, true, true, false],
  [true, true, true, true, false, false, false]
] as const)('Boolean truth table for %s and %s', (left, right, and, or, xor, nand, nor) => {
  const { parse } = setup('BOOLEAN')
  expect(
    ['AND', 'OR', 'XOR', 'NAND', 'NOR'].map(
      (operator) => parse(`${left} ${operator} ${right}`).resolved
    )
  ).toEqual([and, or, xor, nand, nor])
})

test('numeric formulas can drive imported color opacity expressions', () => {
  const { graph, collection, derived, base, mode, set } = setup()
  set('{base} * 5')
  const color = graph.createVariable('scrim', 'COLOR', collection.id, {
    expression: 'COMPOSE_COLOR',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: { aliasId: derived.id }
  })
  expect(graph.resolveColorVariable(color.id)?.a).toBe(0.2)
  base.valuesByMode[mode] = 6
  expect(graph.resolveColorVariable(color.id)?.a).toBe(0.3)
})

test('references with duplicate or reserved names retain editable ID fallbacks', () => {
  const { graph, base, derived, mode, parse, set } = setup()
  set('{base} * 2')
  base.name = '{reserved}'
  const text = formatVariableFormula(graph, derived.valuesByMode[mode])
  expect(text).toContain(`{#${base.id}}`)
  expect(parse(text).resolved).toBe(8)
  base.valuesByMode[mode] = Infinity
  expect(() => parse(`{#${base.id}}`)).toThrow('Non-finite')
})

test('references follow explicit, active, and inherited modes across collections', () => {
  const { graph, collection, base, derived, mode, set } = setup()
  graph.addMode(collection.id, 'large', 'Large')
  base.valuesByMode.large = 10
  set('{base} * 2')
  derived.valuesByMode.large = derived.valuesByMode[mode]
  expect(graph.resolveVariable(derived.id, 'large')).toBe(20)
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    variableModes: { [collection.id]: 'large' }
  })
  const child = graph.createNode('RECTANGLE', frame.id)
  expect(graph.resolveNumberVariableForNode(child.id, derived.id)).toBe(20)
  const other = graph.createCollection('Other')
  const scalar = graph.createVariable('factor', 'FLOAT', other.id, 3)
  graph.addMode(other.id, 'double', 'Double')
  scalar.valuesByMode.double = 5
  graph.setActiveMode(other.id, 'double')
  set('{base} * {Other::factor}')
  expect(graph.resolveVariable(derived.id)).toBe(20)
})

test('qualified names, missing dependencies, reference remapping and runtime validation', () => {
  const { graph, collection, base, derived, mode, set, parse } = setup()
  const other = graph.createCollection('Other')
  graph.createVariable('base', 'FLOAT', other.id, 10)
  expect(parse('{Other::base} + {base}').resolved).toBe(14)
  set('{base} * 2')
  const definition = derived.valuesByMode[mode]
  expect(v.safeParse(variableFormulaSchema, definition).success).toBe(true)
  expect(variableValueReferences(definition)).toEqual([base.id])
  const remapped = mapVariableValueReferences(definition, (id) => `copy:${id}`)
  expect(variableValueReferences(remapped)).toEqual([`copy:${base.id}`])
  expect(graph.variableCollections.has(collection.id)).toBe(true)
  graph.removeVariable(base.id)
  expect(graph.resolveVariable(derived.id)).toBeUndefined()
  expect(() => parse(formatVariableFormula(graph, definition))).toThrow()
  expect(
    v.safeParse(variableFormulaSchema, { expression: 'FORMULA', type: 'FLOAT', value: Infinity })
      .success
  ).toBe(false)
})

test('shared formula dependencies resolve once per evaluation and never cache across edits', () => {
  const { graph, collection, base, mode } = setup()
  let previous = base
  for (let i = 0; i < 25; i++) {
    const value: VariableValue = {
      expression: 'FORMULA',
      type: 'FLOAT',
      value: {
        operator: 'ADDITION',
        operands: [{ aliasId: previous.id }, { aliasId: previous.id }]
      }
    }
    previous = graph.createVariable(`level${i}`, 'FLOAT', collection.id, value)
  }
  expect(graph.resolveVariable(previous.id)).toBe(134217728)
  base.valuesByMode[mode] = 2
  expect(graph.resolveVariable(previous.id)).toBe(67108864)
})

test('100 consumers share one calculation per mode during a batch', () => {
  const { graph, collection, base, derived, mode, set } = setup()
  set('{base} * 2')
  graph.addMode(collection.id, 'large', 'Large')
  base.valuesByMode.large = 10
  const nodes = Array.from({ length: 100 }, (_, index) =>
    graph.createNode('FRAME', graph.getPages()[0].id, {
      variableModes: index % 2 === 0 ? {} : { [collection.id]: 'large' }
    })
  )
  const get = spyOn(graph.variables, 'get')
  try {
    const resolve = createBatchVariableResolver(graph)
    for (const [index, node] of nodes.entries())
      expect(resolve(node.id, derived.id)).toBe(index % 2 === 0 ? 8 : 20)
    expect(get.mock.calls.filter(([id]) => id === derived.id)).toHaveLength(2)
    base.valuesByMode[mode] = 6
    expect(createBatchVariableResolver(graph)(nodes[0].id, derived.id)).toBe(12)
  } finally {
    get.mockRestore()
  }
})

test('numeric schema and resolver reject invalid formula trees', () => {
  const values: VariableFormulaNode[] = [
    { operator: 'ADDITION', operands: [true, 1] },
    { operator: 'ADDITION', operands: [1] },
    { operator: 'NOT', operands: [true] },
    { operator: 'MULTIPLY', operands: [1, { operator: 'OR', operands: [false, true] }] },
    { operator: 'DIVIDE', operands: [Infinity, 2] }
  ]
  const { graph, derived, mode } = setup()
  for (const value of values) {
    const definition: VariableValue = { expression: 'FORMULA', type: 'FLOAT', value }
    expect(v.safeParse(variableFormulaSchema, definition).success).toBe(false)
    derived.valuesByMode[mode] = definition
    expect(graph.resolveVariable(derived.id)).toBeUndefined()
  }
})

test('bounded schema rejects deeply nested and cyclic input', () => {
  const value: VariableValue = { expression: 'FORMULA', type: 'FLOAT', value: 1 }
  if (!('expression' in value) || value.expression !== 'FORMULA')
    throw new Error('Expected formula')
  for (let i = 0; i < 65; i++) value.value = { operator: 'NEGATE', operands: [value.value] }
  expect(v.safeParse(variableFormulaSchema, value).success).toBe(false)
  const operands: VariableFormulaNode[] = [1]
  const cyclic: VariableFormulaNode = { operator: 'NEGATE', operands }
  operands[0] = cyclic
  expect(
    v.safeParse(variableFormulaSchema, { expression: 'FORMULA', type: 'FLOAT', value: cyclic })
      .success
  ).toBe(false)
})

test('a depth-limited batch lookup does not poison a later shallow lookup', () => {
  const { graph, collection, base } = setup()
  let previous = base
  const chain = [base]
  for (let i = 0; i < 65; i++) {
    previous = graph.createVariable(`alias${i}`, 'FLOAT', collection.id, { aliasId: previous.id })
    chain.push(previous)
  }
  const node = graph.createNode('FRAME', graph.getPages()[0].id)
  const resolve = createBatchVariableResolver(graph)
  expect(resolve(node.id, previous.id)).toBeUndefined()
  expect(resolve(node.id, chain[2].id)).toBe(4)
  expect(resolve(node.id, base.id)).toBe(4)
})

test('collection discovery follows formulas and composed color operands transitively', () => {
  const { graph, collection, derived, set } = setup()
  const other = graph.createCollection('Other')
  graph.createVariable('factor', 'FLOAT', other.id, 2)
  set('{Other::factor} * 10')
  const colors = graph.createCollection('Colors')
  const color = graph.createVariable('scrim', 'COLOR', colors.id, {
    expression: 'COMPOSE_COLOR',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: { aliasId: derived.id }
  })
  const node = graph.createNode('FRAME', graph.getPages()[0].id, {
    boundVariables: { fillColor: color.id }
  })
  expect(collectionsBoundIn(graph, [node.id])).toEqual(
    new Set([colors.id, collection.id, other.id])
  )
})
