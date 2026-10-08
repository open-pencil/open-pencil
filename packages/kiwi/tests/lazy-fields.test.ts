import { describe, expect, test } from 'bun:test'

import { compileSchema, parseSchema, type LazyFields } from '../src/schema-runtime'
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
}

message Document {
  Item[] items = 1;
}
`)

function encoded(): Uint8Array {
  const eager = compileSchema(schema)
  const encode = eager.encodeDocument as (message: RuntimeMessage) => Uint8Array
  return encode({
    items: [
      { id: 1, outline: [{ x: 1, y: 2 }], note: 'first' },
      { id: 2, note: 'second' }
    ]
  })
}

function decode(lazy: LazyFields) {
  const codec = compileSchema(schema, lazy)
  const decodeDocument = codec.decodeDocument as (bytes: Uint8Array) => { items: RuntimeMessage[] }
  return decodeDocument(encoded()).items
}

describe('lazy fields', () => {
  test('decode when read, every time, and keep nothing', () => {
    const [first, second] = decode({ fields: { Item: ['outline'] } })

    expect(first.outline).toEqual([{ x: 1, y: 2 }])
    expect(first.outline).not.toBe(first.outline)
    expect(first.note).toBe('first')
    expect('outline' in second).toBe(false)
  })

  test('copies carry the decoded value, and an assignment replaces the field', () => {
    const [first] = decode({ fields: { Item: ['outline'] } })

    expect({ ...first }.outline).toEqual([{ x: 1, y: 2 }])
    expect(structuredClone(first).outline).toEqual([{ x: 1, y: 2 }])
    const replaced = [{ x: 5, y: 6 }]
    first.outline = replaced
    expect(first.outline).toBe(replaced)
  })

  test('the prepare hook sees every value a field decodes', () => {
    const lazy: LazyFields = { fields: { Item: ['outline'] } }
    const [first] = decode(lazy)
    lazy.prepare = (owner, field, value) => {
      if (field === 'outline' && Array.isArray(value)) value.push({ x: Number(owner.id), y: 0 })
    }

    expect(first.outline).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 0 }
    ])
    expect(first.outline).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 0 }
    ])
  })
})
