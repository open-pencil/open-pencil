import { describe, expect, test } from 'bun:test'

import * as Y from 'yjs'

import { writeRecord } from '@/app/collab/records'

/** Two peers of one room, each with the record's map, and a way to exchange what they wrote. */
function peers() {
  const first = new Y.Doc()
  const second = new Y.Doc()
  const exchange = () => {
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first, Y.encodeStateVector(second)))
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second, Y.encodeStateVector(first)))
  }
  return {
    first: first.getMap<unknown>('record'),
    second: second.getMap<unknown>('record'),
    exchange
  }
}

const BY_MODE = new Set(['valuesByMode'])

describe('room records', () => {
  test('peers changing different fields both keep their change', () => {
    const { first, second, exchange } = peers()
    writeRecord(first, { name: 'Brand', hidden: false })
    exchange()
    writeRecord(first, { name: 'Primary', hidden: false })
    writeRecord(second, { name: 'Brand', hidden: true })
    exchange()
    expect(first.toJSON()).toEqual({ name: 'Primary', hidden: true })
    expect(second.toJSON()).toEqual(first.toJSON())
  })

  test('peers changing different entries of a nested field both keep theirs', () => {
    const { first, second, exchange } = peers()
    writeRecord(first, { valuesByMode: { light: 1, dark: 2 } }, { nested: BY_MODE })
    exchange()
    writeRecord(first, { valuesByMode: { light: 10, dark: 2 } }, { nested: BY_MODE })
    writeRecord(second, { valuesByMode: { light: 1, dark: 20 } }, { nested: BY_MODE })
    exchange()
    expect(first.toJSON()).toEqual({ valuesByMode: { light: 10, dark: 20 } })
  })

  test('drops fields the record lacks unless told to leave them', () => {
    const { first } = peers()
    writeRecord(first, { name: 'Brand', parents: 'kept by the tree' })
    writeRecord(first, { name: 'Brand' }, { drop: false })
    expect(first.toJSON()).toEqual({ name: 'Brand', parents: 'kept by the tree' })
    writeRecord(first, { name: 'Brand', description: undefined })
    expect(first.toJSON()).toEqual({ name: 'Brand' })
  })
})
