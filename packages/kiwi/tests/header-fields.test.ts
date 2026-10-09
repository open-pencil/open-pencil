import { describe, expect, test } from 'bun:test'

import { compileSchema, decodeWhole, parseSchema, type HeaderFields } from '../src/schema-runtime'
import type { RuntimeMessage } from '../src/schema-runtime/interpreter'

const schema = parseSchema(`
package Example;

struct Point {
  float x;
  float y;
}

message Item {
  uint id = 1;
  Point[] outline = 2;
  string note = 3;
  Item[] children = 4;
}

message Document {
  Item[] items = 1;
}
`)

const document = {
  items: [
    {
      id: 1,
      outline: [{ x: 1, y: 2 }],
      note: 'first',
      children: [{ id: 3, note: 'nested', children: [{ id: 4, note: 'deeper' }] }]
    },
    { id: 2, note: 'second' }
  ]
}

function decode(headers?: HeaderFields): RuntimeMessage[] {
  const encode = compileSchema(schema).encodeDocument as (message: RuntimeMessage) => Uint8Array
  const codec = compileSchema(schema, headers)
  const decodeDocument = codec.decodeDocument as (bytes: Uint8Array) => { items: RuntimeMessage[] }
  return decodeDocument(encode(document as RuntimeMessage)).items
}

describe('header fields', () => {
  test('a header keeps the named fields, and reads whole into every field', () => {
    const items = decode({ Item: ['id'] })

    expect(items).toEqual([{ id: 1 }, { id: 2 }])
    expect<unknown>(items.map((item) => decodeWhole(item))).toEqual(document.items)
  })

  test('a message nesting its own type reads whole all the way down', () => {
    const [first] = decode({ Item: ['id'] })

    const whole = decodeWhole(first)

    expect<unknown>(whole?.children).toEqual(document.items[0].children)
  })

  test('a message decoded whole, or a copy of a header, is no header', () => {
    const [eager] = decode()
    const [header] = decode({ Item: ['id'] })

    expect(decodeWhole(eager)).toBeUndefined()
    expect(decodeWhole({ ...header })).toBeUndefined()
    expect(decodeWhole(structuredClone(header))).toBeUndefined()
  })
})
