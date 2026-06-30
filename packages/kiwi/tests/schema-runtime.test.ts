import { describe, expect, test } from 'bun:test'

import {
  compileSchema,
  expectEnumValue,
  expectFieldNumber,
  parseSchema,
  validateSchema
} from '../src/schema-runtime'

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
})
