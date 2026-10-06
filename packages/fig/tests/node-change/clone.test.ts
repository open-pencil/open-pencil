import { expect, test } from 'bun:test'

import { cloneRecord } from '#fig/node-change/clone'

test('a cloned record shares no mutable data with its source', () => {
  const source = {
    name: 'Node',
    size: { x: 1, y: 2 },
    fillPaints: [{ color: { r: 1, g: 0, b: 0, a: 1 }, stops: [{ position: 0 }] }],
    textData: { characters: 'Hello', styleOverrideTable: [{ fontSize: 12 }] }
  }
  const copy = cloneRecord(source)
  expect(copy).toEqual(source)
  copy.size.x = 9
  copy.fillPaints[0].color.r = 0
  copy.fillPaints[0].stops[0].position = 1
  copy.textData.styleOverrideTable[0].fontSize = 99
  expect(source.size.x).toBe(1)
  expect(source.fillPaints[0].color.r).toBe(1)
  expect(source.fillPaints[0].stops[0].position).toBe(0)
  expect(source.textData.styleOverrideTable[0].fontSize).toBe(12)
})

/** Blob payloads are bytes, not objects to walk field by field. */
test('a byte buffer is copied as a buffer', () => {
  const source = { bytes: new Uint8Array([1, 2, 3]) }
  const copy = cloneRecord(source)
  expect(copy.bytes).toBeInstanceOf(Uint8Array)
  expect([...copy.bytes]).toEqual([1, 2, 3])
  copy.bytes[0] = 9
  expect(source.bytes[0]).toBe(1)
})

test('primitives, null and undefined survive unchanged', () => {
  expect(cloneRecord({ a: null, b: undefined, c: 0, d: '', e: false })).toEqual({
    a: null,
    b: undefined,
    c: 0,
    d: '',
    e: false
  })
})

/** Anything that is not plain data goes through the structured algorithm instead. */
test('a non-plain object is cloned structurally', () => {
  const source = { when: new Date(0), which: new Map([['a', 1]]) }
  const copy = cloneRecord(source)
  expect(copy.when).toBeInstanceOf(Date)
  expect(copy.when).not.toBe(source.when)
  expect(copy.which.get('a')).toBe(1)
  expect(copy.which).not.toBe(source.which)
})
