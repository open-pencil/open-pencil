import { expect, test } from 'bun:test'

import * as v from 'valibot'

import { SceneGraph, type VariableType } from '@open-pencil/scene-graph'
import { formatVariableFormula, formulaTokens, parseVariableFormula, variableFormulaSchema } from '@open-pencil/scene-graph/variables'

/** A variable of each type to refer to, and one of `type` whose formula is parsed. */
function setup(type: VariableType) {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const mode = collection.defaultModeId
  graph.createVariable('count', 'FLOAT', collection.id, 3)
  graph.createVariable('width', 'FLOAT', collection.id, 640)
  graph.createVariable('dark', 'BOOLEAN', collection.id, true)
  graph.createVariable('name', 'STRING', collection.id, 'Ada')
  graph.createVariable('ink', 'COLOR', collection.id, { r: 0, g: 0, b: 0, a: 1 })
  const placeholder = { FLOAT: 0, BOOLEAN: false, STRING: '', COLOR: { r: 1, g: 1, b: 1, a: 1 } }
  const derived = graph.createVariable('derived', type, collection.id, placeholder[type])
  const parse = (source: string) => parseVariableFormula(graph, derived.id, mode, source)
  const print = (source: string) => formatVariableFormula(graph, parse(source).value)
  return { graph, parse, print }
}

// What Figma resolved for each expression, pasted into Figma desktop on 2026-10-20.
test.each([
  ['text(1.5)', '1.50'],
  ['text(0.125)', '0.12'],
  ['text(100)', '100'],
  ['text(true)', 'true'],
  ['text("abc")', 'abc'],
  ['"a" + "b"', 'ab'],
  ['"a" + 1.5', 'a1.50'],
  ['1 + "b"', '1b'],
  ['true + "x"', 'truex'],
  ['"n=" + 3', 'n=3'],
  ['text({count}) + " items"', '3 items'],
  ['if({dark}, "Dark", "Light")', 'Dark']
] as const)('text formulas give what Figma gives: %s', (source, expected) => {
  expect(setup('STRING').parse(source).resolved).toBe(expected)
})

test.each([
  ['0', false],
  ['1', true],
  ['-1', true],
  ['""', false],
  ['"a"', true],
  ['"0"', true],
  ['"false"', false],
  ['"False"', false],
  ['" false"', false],
  ['"no"', false],
  ['"OFF"', false],
  ['"null"', true],
  ['" "', true],
  ['"n o"', true],
  ['true', true],
  ['false', false]
] as const)('truthy(%s) is what Figma reads it as', (operand, expected) => {
  expect(setup('BOOLEAN').parse(`truthy(${operand})`).resolved).toBe(expected)
})

test('if() picks a number, a value of a variable, or a color', () => {
  expect(setup('FLOAT').parse('if(true, 1, 2)').resolved).toBe(1)
  expect(setup('FLOAT').parse('if({width} > 600, {count} * 2, 0)').resolved).toBe(6)
  expect(setup('BOOLEAN').parse('if(truthy({name}), {dark}, false)').resolved).toBe(true)
  expect(setup('COLOR').parse('if({dark}, {ink}, #FFFFFF)').resolved).toEqual({
    r: 0,
    g: 0,
    b: 0,
    a: 1
  })
  expect(setup('COLOR').parse('if(not {dark}, {ink}, #FF000080)').resolved).toMatchObject({
    r: 1,
    g: 0,
    b: 0
  })
})

test.each([
  ['FLOAT', 'if(5, 1, 2)', 'if() needs true or false, then two values of the same type'],
  ['FLOAT', 'if(true, 1, "a")', 'if() needs true or false, then two values of the same type'],
  ['FLOAT', 'if(true, 1)', 'if() takes 3 values'],
  ['STRING', 'text()', 'text() takes 1 value'],
  ['STRING', 'text({ink})', 'text() needs a number, text, or true or false'],
  ['FLOAT', '"a" - 1', '- needs numbers'],
  ['BOOLEAN', '"1" == 1', '== compares two numbers, two texts, or two true or false values'],
  ['FLOAT', 'true + 1', '+ adds numbers or joins text'],
  ['STRING', '"abc', 'A text is missing its closing "'],
  ['STRING', 'if true', 'Write if(…)'],
  ['FLOAT', '"a" + 1', 'This gives text, but derived holds a number'],
  ['COLOR', '#12345', 'Unexpected #']
] as const)('%s formula %s is refused: %s', (type, source, message) => {
  expect(() => setup(type).parse(source)).toThrow(message)
})

test.each([
  ['"a" + (1 + 2)', '"a" + (1 + 2)'],
  ['"a" + ("b" + "c")', '"a" + "b" + "c"'],
  ['{name} + ({count} + 1)', '{name} + ({count} + 1)'],
  ['"a" + (1 + 2 + "b")', '"a" + (1 + 2 + "b")'],
  ['1 + (2 + "b")', '1 + (2 + "b")'],
  ['"a" + ("b" + 1 + "c")', '"a" + ("b" + 1 + "c")'],
  ['IF({dark}, "Hi", "Hello, " + {name})', 'if({dark}, "Hi", "Hello, " + {name})'],
  ['"say \\"hi\\"" + text({count})', '"say \\"hi\\"" + text({count})']
] as const)('text formulas print so that they read back the same: %s', (source, printed) => {
  const { parse, print } = setup('STRING')
  expect(print(source)).toBe(printed)
  expect(parse(printed).resolved).toBe(parse(source).resolved)
})

test('colors print as hex, with opacity only when they have it', () => {
  const { print } = setup('COLOR')
  expect(print('if({dark}, #ff0000, #00FF0080)')).toBe('if({dark}, #FF0000, #00FF0080)')
})

test('literal text and colors print as the field reads them back', () => {
  const { graph } = setup('STRING')
  expect(formatVariableFormula(graph, 'Hello "you"')).toBe('"Hello \\"you\\""')
  expect(formatVariableFormula(graph, { r: 1, g: 0, b: 0, a: 1 })).toBe('#FF0000')
})

test('the schema takes text and color formulas, and refuses operands that do not fit', () => {
  const formula = (type: VariableType, value: unknown) =>
    v.safeParse(variableFormulaSchema, { expression: 'FORMULA', type, value }).success
  const ternary = (operands: unknown[]) => ({ operator: 'if', operands })
  const red = { r: 1, g: 0, b: 0, a: 1 }
  expect(formula('STRING', { operator: 'text', operands: [1.5] })).toBe(true)
  expect(formula('COLOR', ternary([{ aliasId: 'flag' }, red, { aliasId: 'ink' }]))).toBe(true)
  expect(formula('FLOAT', ternary([true, 1, 2]))).toBe(true)
  expect(formula('FLOAT', ternary([1, 1, 2]))).toBe(false)
  expect(formula('STRING', ternary([true, 1, 2]))).toBe(false)
  expect(formula('FLOAT', { operator: 'text', operands: [1] })).toBe(false)
  expect(formula('FLOAT', { operator: 'if', operands: [true, 1] })).toBe(false)
})

test('the tokenizer reads text, colors, calls and commas, and text still being typed', () => {
  expect(formulaTokens('if({a}, "x, y", #FF0000)').map(({ kind }) => kind)).toEqual([
    'function',
    'paren',
    'reference',
    'comma',
    'string',
    'comma',
    'color',
    'paren'
  ])
  expect(formulaTokens('"Hello, {na').map(({ kind, text }) => [kind, text])).toEqual([
    ['string', '"Hello, {na']
  ])
})
