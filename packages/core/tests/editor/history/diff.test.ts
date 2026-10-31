import { describe, expect, test } from 'bun:test'

import { diffFields } from '#core/editor/history/diff'

describe('record field changes', () => {
  test('keeps union-key order, absence and explicit undefined distinct', () => {
    const before: Record<string, unknown> = { first: 1, removed: undefined, same: 2 }
    const after: Record<string, unknown> = { added: undefined, first: 3, same: 2 }
    const change = diffFields('record', before, after)
    expect(change).toEqual({
      id: 'record',
      before: { first: 1, removed: undefined, added: undefined },
      after: { first: 3, removed: undefined, added: undefined },
      absent: { before: ['added'], after: ['removed'] }
    })
    expect(Object.keys(change?.after ?? {})).toEqual(['first', 'removed', 'added'])
  })

  test('compares a union key once when reading current keys changes the previous descriptor', () => {
    const before: Record<string, unknown> = { value: 0 }
    const target: Record<string, unknown> = { value: 1 }
    let valueReads = 0
    const after = new Proxy(target, {
      ownKeys: (current) => {
        Object.defineProperty(before, 'value', { enumerable: false })
        return Reflect.ownKeys(current)
      },
      get: (current, key, receiver) => {
        if (key === 'value') valueReads++
        const value: unknown = Reflect.get(current, key, receiver)
        return value
      }
    })
    expect(diffFields('record', before, after)?.after).toEqual({ value: 1 })
    expect(valueReads).toBe(2)
  })

  test('copies nested values without sharing them with either input', () => {
    const before = { values: [{ count: 1 }] }
    const after = { values: [{ count: 2 }] }
    const change = diffFields('record', before, after)
    before.values[0].count = 3
    after.values[0].count = 4
    expect(change?.before.values).toEqual([{ count: 1 }])
    expect(change?.after.values).toEqual([{ count: 2 }])
  })

  test('unchanged and skipped fields produce no changes', () => {
    expect(
      diffFields('record', { value: Number.NaN, zero: -0 }, { value: Number.NaN, zero: 0 })
    ).toBeNull()
    expect(diffFields('record', { value: 1 }, { value: 2 }, new Set(['value']))).toBeNull()
  })

  test('clones each changed field before comparing later fields', () => {
    const before: Record<string, unknown> = { first: 1, later: 1 }
    let laterReads = 0
    const after: Record<string, unknown> = { first: () => undefined }
    Object.defineProperty(after, 'later', {
      enumerable: true,
      get: () => ++laterReads
    })
    expect(() => diffFields('record', before, after)).toThrow()
    expect(laterReads).toBe(0)
  })
})
