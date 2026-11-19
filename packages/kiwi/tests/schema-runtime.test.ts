import { describe, expect, test } from 'bun:test'

import { figmaSchema as figSchema } from '@open-pencil/kiwi/fig'
import {
  expectEnumValue,
  expectFieldNumber,
  validateSchema
} from '@open-pencil/kiwi/schema-runtime'

import { ByteBuffer, compileSchema, parseSchema } from '../src/schema-runtime'
import type { RuntimeMessage } from '../src/schema-runtime/interpreter'

test('rejects malformed byte fields without corrupting buffer length', () => {
  const buffer = new ByteBuffer()
  expect(() => Reflect.apply(buffer.writeByteArray, buffer, [{ 0: 42 }])).toThrow(
    'Expected byte array'
  )
  expect(buffer.length).toBe(0)
  buffer.writeByteArray(new Uint8Array([42]))
  expect(buffer.toUint8Array()).toEqual(new Uint8Array([1, 42]))
})

const schemaText = `
package Example;

enum Kind {
  CARD = 1;
  BADGE = 2;
}

message Item {
  uint id = 1;
  string name = 2;
  Kind kind = 3;
  string[] tags = 4;
}
`

describe('Kiwi schema runtime', () => {
  test('parses and validates inline schemas', () => {
    const schema = parseSchema(schemaText)
    validateSchema(schema)

    expectFieldNumber(schema, 'Item', 'name', 2)
    expectFieldNumber(schema, 'Item', 'tags', 4)
    expectEnumValue(schema, 'Kind', 'BADGE', 2)
  })

  test('compiles schemas and round-trips messages', () => {
    const schema = parseSchema(schemaText)
    const codec = compileSchema(schema)
    const encodeItem = codec.encodeItem as (value: RuntimeMessage) => Uint8Array
    const decodeItem = codec.decodeItem as (value: Uint8Array) => RuntimeMessage

    const encoded = encodeItem({ id: 42, name: 'OpenPencil', kind: 'CARD', tags: ['kiwi'] })
    expect(encoded.length).toBeGreaterThan(0)
    expect(decodeItem(encoded)).toEqual({
      id: 42,
      name: 'OpenPencil',
      kind: 'CARD',
      tags: ['kiwi']
    })
  })

  test('compiles and round-trips without calling the Function constructor', () => {
    const OriginalFunction = globalThis.Function
    globalThis.Function = new Proxy(OriginalFunction, {
      construct() {
        throw new EvalError(
          "Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script"
        )
      }
    })

    try {
      const codec = compileSchema(parseSchema(schemaText))
      const encodeItem = codec.encodeItem as (value: RuntimeMessage) => Uint8Array
      const decodeItem = codec.decodeItem as (value: Uint8Array) => RuntimeMessage
      const encoded = encodeItem({ id: 7, name: 'CSP-safe', kind: 'BADGE', tags: [] })
      expect(decodeItem(encoded)).toEqual({
        id: 7,
        name: 'CSP-safe',
        kind: 'BADGE',
        tags: []
      })
    } finally {
      globalThis.Function = OriginalFunction
    }
  })

  test('uses the codec ByteBuffer override', () => {
    class CustomByteBuffer extends ByteBuffer {}

    const codec = compileSchema(parseSchema(schemaText))
    codec.ByteBuffer = CustomByteBuffer

    const encoded = (codec.encodeItem as (value: RuntimeMessage) => Uint8Array)({
      id: 1,
      name: 'custom',
      kind: 'CARD',
      tags: []
    })
    const decoded = (codec.decodeItem as (value: Uint8Array) => RuntimeMessage)(encoded)

    expect(decoded.name).toBe('custom')
  })

  test('reports unknown field types at their source location', () => {
    const malformedSchema = {
      package: null,
      definitions: [
        {
          name: 'Item',
          line: 4,
          column: 1,
          kind: 'MESSAGE' as const,
          fields: [
            {
              name: 'value',
              line: 5,
              column: 3,
              type: 'MissingType',
              isArray: false,
              isDeprecated: false,
              value: 1
            }
          ]
        }
      ]
    }

    expect(() => compileSchema(malformedSchema)).toThrow(
      'Invalid type "MissingType" for field "value"'
    )
    try {
      compileSchema(malformedSchema)
    } catch (error) {
      expect(error).toMatchObject({ line: 5, column: 3 })
    }
  })

  test('rejects inherited names as field types', () => {
    const malformedSchema = {
      package: null,
      definitions: [
        {
          name: 'Item',
          line: 4,
          column: 1,
          kind: 'MESSAGE' as const,
          fields: [
            {
              name: 'value',
              line: 5,
              column: 3,
              type: 'constructor',
              isArray: false,
              isDeprecated: false,
              value: 1
            }
          ]
        }
      ]
    }

    expect(() => compileSchema(malformedSchema)).toThrow(
      'Invalid type "constructor" for field "value"'
    )
    try {
      compileSchema(malformedSchema)
    } catch (error) {
      expect(error).toMatchObject({ line: 5, column: 3 })
    }
  })
})

describe('Kiwi schema runtime', () => {
  test('validates the static Figma schema', () => {
    validateSchema(figSchema)
  })

  test('keeps the bundled schema aligned with a modern embedded Figma schema', () => {
    expect(figSchema.definitions).toHaveLength(605)
    expect(figSchema.definitions.some((def) => def.name === 'NodeChange')).toBe(true)
    expect(figSchema.definitions.some((def) => def.name === 'InteractiveSlideElementChange')).toBe(
      true
    )
  })

  test('keeps Figma clipboard-derived field numbers for emitted roundtrip fields', () => {
    expectFieldNumber(figSchema, 'Paint', 'colorVar', 21)
    expectFieldNumber(figSchema, 'TextLineData', 'sourceDirectionality', 9)
    expectFieldNumber(figSchema, 'NodeChange', 'pageType', 397)
    expectFieldNumber(figSchema, 'ComponentPropDef', 'varValue', 9)

    expectEnumValue(figSchema, 'VariableField', 'TEXT_DATA', 11)
    expectEnumValue(figSchema, 'VariableField', 'STACK_COUNTER_SPACING', 23)
    expectEnumValue(figSchema, 'VariableField', 'OVERRIDDEN_SYMBOL_ID', 37)
    expectEnumValue(figSchema, 'EditorType', 'DESIGN', 0)
    expectEnumValue(figSchema, 'EditorType', 'SLIDES', 2)
  })

  test('keeps Figma-derived field numbers for layout and glyph fields', () => {
    expectFieldNumber(figSchema, 'NodeChange', 'stackWrap', 323)
    expectFieldNumber(figSchema, 'NodeChange', 'stackCounterSpacing', 324)
    expectFieldNumber(figSchema, 'NodeChange', 'gridChildVerticalAlign', 476)
    expectFieldNumber(figSchema, 'NodeChange', 'gridChildHorizontalAlign', 477)
    expectFieldNumber(figSchema, 'Glyph', 'emojiCodePoints', 7)
    expectFieldNumber(figSchema, 'Glyph', 'rotation', 9)
  })
})
