import { describe, expect, test } from 'bun:test'

// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toStandardJsonSchema as toStandardJSONSchema } from '@valibot/to-json-schema'
import * as v from 'valibot'

import { toolNumber } from '@open-pencil/core/tools'

import { getTool, setupToolTest } from '#tests/helpers/tools'

describe('native tool input contracts', () => {
  const schema = v.object({ value: toolNumber(v.pipe(v.number(), v.minValue(0), v.maxValue(100))) })

  test.each([
    Infinity,
    -Infinity,
    Number.NaN,
    'Infinity',
    '-Infinity',
    'NaN',
    '1e999',
    'abc',
    '',
    ' ',
    '\t\n'
  ])('rejects non-finite or invalid numeric input %s', async (value) => {
    expect(v.safeParse(schema, { value }).success).toBe(false)
    const standard = toStandardJSONSchema(schema)
    expect((await standard['~standard'].validate({ value })).issues).toBeDefined()
  })

  test('numeric strings share numeric bounds and output types', () => {
    expect(v.parse(schema, { value: '42' })).toEqual({ value: 42 })
    expect(v.parse(schema, { value: ' 42 ' })).toEqual({ value: 42 })
    expect(v.safeParse(schema, { value: '101' }).success).toBe(false)
    expect(v.safeParse(schema, { value: '-1' }).success).toBe(false)
  })

  test('JSON Schema advertises canonical numeric bounds and the string compatibility input', () => {
    const standard = toStandardJSONSchema(schema)
    expect(standard['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
      properties: {
        value: { anyOf: [{ type: 'number', minimum: 0, maximum: 100 }, { type: 'string' }] }
      }
    })
  })

  test('direct execution validates and normalizes the same declared schema', () => {
    const { figma } = setupToolTest()
    const node = figma.createRectangle()
    const tool = getTool('set_opacity')
    tool.execute(figma, { id: node.id, value: '0.5' })
    expect(node.opacity).toBe(0.5)
    expect(() => tool.execute(figma, { id: node.id, value: 'Infinity' })).toThrow()
    expect(() => tool.execute(figma, { id: node.id, value: '  ' })).toThrow()
    expect(node.opacity).toBe(0.5)
  })

  test.each([
    { name: 'analyze_spacing', field: 'grid', invalid: [0, -1], valid: [0.5, 8] },
    { name: 'arrange', field: 'cols', invalid: [0, -1, 1.5], valid: [1, 3] },
    { name: 'get_components', field: 'limit', invalid: [-1, 1.5], valid: [0, 50] },
    { name: 'update_node', field: 'font_weight', invalid: [99, 901], valid: [100, 900] }
  ])('$name validates $field before execution', ({ name, field, invalid, valid }) => {
    const input = getTool(name).input
    const base = 'id' in input.entries ? { id: 'node' } : {}
    for (const value of invalid) {
      expect(v.safeParse(input, { ...base, [field]: value }).success).toBe(false)
      expect(v.safeParse(input, { ...base, [field]: String(value) }).success).toBe(false)
    }
    for (const value of valid) {
      expect(v.safeParse(input, { ...base, [field]: value }).success).toBe(true)
      expect(v.safeParse(input, { ...base, [field]: String(value) }).success).toBe(true)
    }
  })

  test.each([
    'group_nodes',
    'boolean_subtract',
    'boolean_union',
    'boolean_intersect',
    'boolean_exclude'
  ])('%s advertises and enforces at least two operands', (name) => {
    const input = getTool(name).input
    expect(v.safeParse(input, { ids: ['one'] }).success).toBe(false)
    expect(v.safeParse(input, { ids: ['one', 'two'] }).success).toBe(true)
    const standard = toStandardJSONSchema(input)
    expect(standard['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
      properties: { ids: { minItems: 2 } }
    })
  })

  test('font weight bounds also appear in the generated schema', () => {
    const standard = toStandardJSONSchema(getTool('update_node').input)
    expect(standard['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
      properties: { font_weight: { anyOf: [{ minimum: 100, maximum: 900 }, { type: 'string' }] } }
    })
  })

  test('defaults and enum aliases remain schema-owned', () => {
    const tool = getTool('create_shape')
    const args = v.parse(tool.input, { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10 })
    expect(args.type).toBe('RECTANGLE')
    expect(v.parse(getTool('get_components').input, {}).source).toBe('all')
    expect(v.safeParse(tool.input, { type: 'not-a-shape' }).success).toBe(false)
  })
})
