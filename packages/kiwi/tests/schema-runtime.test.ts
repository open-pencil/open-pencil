import { describe, expect, test } from 'bun:test'

import {
  ByteBuffer,
  compileSchema,
  expectEnumValue,
  expectFieldNumber,
  parseSchema,
  validateSchema
} from '../src/schema-runtime'

interface RuntimeMessage {
  [name: string]:
    | boolean
    | number
    | string
    | bigint
    | Uint8Array
    | RuntimeMessage
    | RuntimeMessage[]
}

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
    interface ItemCodec {
      encodeItem(value: unknown): Uint8Array
      decodeItem(value: Uint8Array): unknown
    }

    const codec = compileSchema(schema) as ItemCodec

    const encoded = codec.encodeItem({ id: 42, name: 'OpenPencil', kind: 'CARD', tags: ['kiwi'] })
    expect(encoded.length).toBeGreaterThan(0)
    expect(codec.decodeItem(encoded)).toEqual({
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
      const codec = compileSchema(parseSchema(schemaText)) as {
        encodeItem(value: unknown): Uint8Array
        decodeItem(value: Uint8Array): unknown
      }
      const encoded = codec.encodeItem({ id: 7, name: 'CSP-safe', kind: 'BADGE', tags: [] })
      expect(codec.decodeItem(encoded)).toEqual({
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
