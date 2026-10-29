import { expect, test, spyOn } from 'bun:test'

import * as v from 'valibot'

import { SceneGraph, type VariableFormulaNode, type VariableValue } from '@open-pencil/scene-graph'
import {
  parseVariableFormula,
  formatVariableFormula,
  variableValueReferences,
  mapVariableValueReferences,
  variableFormulaSchema,
  collectionsBoundIn,
  formulaTokens,
  createBatchVariableResolver
} from '@open-pencil/scene-graph/variables'

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
  expect(formatVariableFormula(graph, derived.valuesByMode[mode])).toBe('{renamed} * 2')
  base.valuesByMode[mode] = 6
  expect(graph.resolveVariable(derived.id)).toBe(12)
})

test.each([
  ['true and false', false],
  ['true OR false', true],
  ['not true', false],
  ['!true || false', false],
  ['true and not false', true],
  ['true or true and false', true],
  ['not ({base} and false)', true],
  ['{base} == true', true],
  ['{base} != false', true]
] as const)('Boolean logic %s', (source, expected) => {
  const { parse } = setup('BOOLEAN')
  expect(parse(source).resolved).toBe(expected)
})

test.each([
  ['{width} > 600', true],
  ['{width} <= 600', false],
  ['{width} * 2 >= 1280 and {width} < 1000', true],
  ['{width} == 640', true],
  ['{width} != 640 or {width} < 0', false],
  ['not {width} > 600', 'needs true or false']
] as const)('number comparisons give Booleans: %s', (source, expected) => {
  const { graph, collection, parse } = setup('BOOLEAN')
  graph.createVariable('width', 'FLOAT', collection.id, 640)
  if (typeof expected === 'string') expect(() => parse(source)).toThrow(expected)
  else expect(parse(source).resolved).toBe(expected)
})

test.each([
  ['{base} * 2 + 3', '{base} * 2 + 3'],
  ['({base} * 2) + 3', '{base} * 2 + 3'],
  ['({base} + 2) * 3', '({base} + 2) * 3'],
  ['{base} - ({base} - 1)', '{base} - ({base} - 1)'],
  ['({base} - {base}) - 1', '{base} - {base} - 1'],
  ['{base} / ({base} * 2)', '{base} / ({base} * 2)'],
  ['{base} + ({base} + 1)', '{base} + {base} + 1'],
  ['-({base})', '-{base}'],
  ['-({base} + 1)', '-({base} + 1)'],
  ['- 4 * {base}', '-4 * {base}'],
  ['-(-{base})', '-(-{base})']
] as const)('numbers print with only the parentheses they need: %s', (source, printed) => {
  const { graph, parse } = setup()
  expect(formatVariableFormula(graph, parse(source).value)).toBe(printed)
})

test.each([
  ['NOT ({base} AND false)', 'not ({base} and false)'],
  ['({base} OR false) AND true', '({base} or false) and true'],
  ['{width} > 1 AND {width} < 2', '{width} > 1 and {width} < 2'],
  ['({width} > 1) == true', '({width} > 1) == true'],
  ['not not {base}', 'not (not {base})']
] as const)('Booleans print with only the parentheses they need: %s', (source, printed) => {
  const { graph, collection, parse } = setup('BOOLEAN')
  graph.createVariable('width', 'FLOAT', collection.id, 640)
  expect(formatVariableFormula(graph, parse(source).value)).toBe(printed)
})

test('bare names resolve like braced ones, and unknown names say so', () => {
  const { parse } = setup()
  expect(parse('base * 3').resolved).toBe(12)
  expect(() => parse('md * 2')).toThrow('No variable named md')
  expect(() => parse('{space/md}')).toThrow('No variable named space/md')
})

test('invalid drafts keep the saved definition intact and restore the shared parser grammar', () => {
  const { parse, derived, mode } = setup()
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
    '1 < 2 < 3',
    '{base',
    '{}',
    '1 +',
    '(1 + 2',
    '1 2',
    '('.repeat(10000)
  ])
    expect(() => parse(source)).toThrow()
  expect(derived.valuesByMode[mode]).toBe(0)
})

test('cycles through other formulas are rejected even in Boolean branches that would short circuit', () => {
  const { base, derived, mode, parse } = setup('BOOLEAN')
  base.valuesByMode[mode] = { aliasId: derived.id }
  expect(() => parse('false and {base}')).toThrow('Circular')
})

test.each([
  [false, false, false, false, true, false],
  [false, true, false, true, false, true],
  [true, false, false, true, false, true],
  [true, true, true, true, true, false]
] as const)('Boolean truth table for %s and %s', (left, right, and, or, equals, notEqual) => {
  const { parse } = setup('BOOLEAN')
  expect(
    ['and', 'or', '==', '!='].map((operator) => parse(`${left} ${operator} ${right}`).resolved)
  ).toEqual([and, or, equals, notEqual])
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
        operator: 'add',
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
    { operator: 'add', operands: [true, 1] },
    { operator: 'add', operands: [1] },
    { operator: 'not', operands: [true] },
    { operator: 'multiply', operands: [1, { operator: 'or', operands: [false, true] }] },
    { operator: 'divide', operands: [Infinity, 2] }
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
  for (let i = 0; i < 65; i++) value.value = { operator: 'negate', operands: [value.value] }
  expect(v.safeParse(variableFormulaSchema, value).success).toBe(false)
  const operands: VariableFormulaNode[] = [1]
  const cyclic: VariableFormulaNode = { operator: 'negate', operands }
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

test('the tokenizer reads half-typed formulas without failing, as an editor needs', () => {
  const kinds = (source: string) => formulaTokens(source).map(({ kind, text }) => `${kind}:${text}`)
  expect(kinds('{space/md} * 2 - base')).toEqual([
    'reference:{space/md}',
    'operator:*',
    'number:2',
    'operator:-',
    'name:base'
  ])
  expect(kinds('NOT (a<=1) and True')).toEqual([
    'keyword:NOT',
    'paren:(',
    'name:a',
    'operator:<=',
    'number:1',
    'paren:)',
    'keyword:and',
    'bool:True'
  ])
  expect(kinds('2 * {spa {base}')).toEqual([
    'number:2',
    'operator:*',
    'reference:{spa ',
    'reference:{base}'
  ])
  expect(kinds('1 # 2')).toEqual(['number:1', 'invalid:#', 'number:2'])
  expect(formulaTokens('{a} + 1').map(({ from, to }) => [from, to])).toEqual([
    [0, 3],
    [4, 5],
    [6, 7]
  ])
})

test('a long formula breaks before its outermost and, or, + and -, and reads back the same', () => {
  const { graph, collection, parse } = setup('BOOLEAN')
  graph.createVariable('viewport', 'FLOAT', collection.id, 1280)
  graph.createVariable('loading', 'BOOLEAN', collection.id, false)
  const source = '{viewport} > 1024 and not {loading} and ({base} or {viewport} < 600)'
  const { value } = parse(source)
  expect(formatVariableFormula(graph, value, { width: 40 })).toBe(
    '{viewport} > 1024\n  and not {loading}\n  and ({base} or {viewport} < 600)'
  )
  expect(formatVariableFormula(graph, value, { width: 200 })).toBe(source)
  expect(parse(formatVariableFormula(graph, value, { width: 40 })).value).toEqual(value)
  // Width counts references as they are shown, such as pills that drop the braces.
  const shown = (id: string) => graph.variables.get(id)?.name ?? id
  expect(formatVariableFormula(graph, value, { width: 60, display: shown })).toBe(source)
  // A chain inside parentheses, or an operator that does not break, stays on its line.
  expect(formatVariableFormula(graph, parse('{viewport} * 2 > 1000').value, { width: 5 })).toBe(
    '{viewport} * 2 > 1000'
  )
})
