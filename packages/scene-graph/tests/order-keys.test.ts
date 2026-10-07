import { describe, expect, test } from 'bun:test'

import {
  fractionalPosition,
  hasOrderKeyBetween,
  orderKeyBetween,
  siblingOrderKeys
} from '@open-pencil/scene-graph/order-keys'

function expectStrictlyIncreasing(keys: string[]) {
  for (let i = 1; i < keys.length; i++) expect(keys[i] > keys[i - 1]).toBe(true)
}

function expectBetween(key: string, lo: string | null, hi: string | null) {
  if (lo !== null) expect(key > lo).toBe(true)
  if (hi !== null) expect(key < hi).toBe(true)
}

describe('fractionalPosition', () => {
  test('numbers siblings with printable keys that sort in index order', () => {
    expect([0, 93, 94, 188].map(fractionalPosition)).toEqual(['!', '~', '~!', '~~!'])
  })
})

describe('orderKeyBetween', () => {
  test('returns a key strictly between its bounds', () => {
    for (const [lo, hi] of [
      [null, '#'],
      ['!', '"'],
      ['~', null],
      ['a', 'b'],
      [null, null]
    ] as const) {
      expectBetween(orderKeyBetween(lo, hi), lo, hi)
    }
  })

  test('stops at a longer prefix of hi when no character can be lowered', () => {
    expect(orderKeyBetween('a', 'a!!')).toBe('a!')
    expect(orderKeyBetween(null, '!!')).toBe('!')
  })

  test('keeps keys short when many keys are appended one after another', () => {
    let lo = '$'
    for (let n = 0; n < 500; n++) {
      const key = orderKeyBetween(lo, null)
      expect(key > lo).toBe(true)
      lo = key
    }
    expect(lo.length).toBeLessThan(100)
  })

  test('returns a key above lo when no printable key fits below hi', () => {
    for (const [lo, hi] of [
      [null, '!'],
      ['a', 'a!'],
      ['b', 'a'],
      ['a', 'a']
    ] as const) {
      expect(hasOrderKeyBetween(lo, hi)).toBe(false)
      const key = orderKeyBetween(lo, hi)
      expect(key).toBe(orderKeyBetween(lo, null))
      if (lo !== null) expect(key > lo).toBe(true)
    }
  })

  test('appends a suffix that keeps the key between its bounds', () => {
    for (const [lo, hi] of [
      [null, null],
      ['!', '#'],
      ['a', 'a!!!'],
      ['~', null],
      [null, '"']
    ] as const) {
      expectBetween(orderKeyBetween(lo, hi, 'xyz'), lo, hi)
    }
    expect(orderKeyBetween('!', '#', 'xyz')).toBe('"xyz')
  })

  test('drops the suffix when only a bare key fits', () => {
    // 'a!' is the only printable key between these bounds; nothing can follow it.
    expect(orderKeyBetween('a', 'a!!', 'xyz')).toBe('a!')
  })

  test('gives inserts at one spot with different suffixes distinct keys with room between', () => {
    const first = orderKeyBetween('!', '#', 'AAA')
    const second = orderKeyBetween('!', '#', 'zzz')
    expect(first < second).toBe(true)
    expectBetween(orderKeyBetween(first, second, 'mmm'), first, second)
  })

  test('keeps keys bounded when many keys are inserted into one gap', () => {
    const suffixes = ['Kq7', '#a~', 'P0P', '!!z', '~~~']
    let hi = '#'
    for (let n = 0; n < 1000; n++) {
      const key = orderKeyBetween('!', hi, suffixes[n % suffixes.length])
      expectBetween(key, '!', hi)
      hi = key
    }
    // Each character halves the gap about six times, so a key grows by one every few inserts.
    expect(hi.length).toBeLessThan(250)
  })
})

describe('siblingOrderKeys', () => {
  test('keeps index keys when no sibling has an imported key', () => {
    expect(siblingOrderKeys([undefined, undefined, undefined])).toEqual([
      fractionalPosition(0),
      fractionalPosition(1),
      fractionalPosition(2)
    ])
  })

  test('keeps imported keys that are still in order', () => {
    const keys = siblingOrderKeys(['!', '#', '%', undefined])
    expect(keys.slice(0, 3)).toEqual(['!', '#', '%'])
    expectStrictlyIncreasing(keys)
  })

  test('gives a layer inserted before imported siblings a key of its own', () => {
    const keys = siblingOrderKeys([undefined, '!', '"', '#'])
    expect(new Set(keys).size).toBe(4)
    expectStrictlyIncreasing(keys)
  })

  test('gives a layer inserted between imported siblings a key between them', () => {
    const keys = siblingOrderKeys(['!', undefined, '"'])
    expect(keys[0]).toBe('!')
    expect(keys[2]).toBe('"')
    expectStrictlyIncreasing(keys)
  })

  test('re-keys only the sibling that was moved out of order', () => {
    const keys = siblingOrderKeys(['$', '!O', '"', '#'])
    expect(keys.slice(1)).toEqual(['!O', '"', '#'])
    expectStrictlyIncreasing(keys)
  })

  test('does not anchor on the lowest key when a sibling has to precede it', () => {
    const keys = siblingOrderKeys(['"', '!', '#'])
    expect(keys[0]).toBe('"')
    expect(keys[2]).toBe('#')
    expectStrictlyIncreasing(keys)
  })

  test('keeps the siblings a moved layer jumped over', () => {
    const keys = siblingOrderKeys([null, '~', '!O', '"', '#'])
    expect(keys.slice(2)).toEqual(['!O', '"', '#'])
    expect(new Set(keys).size).toBe(keys.length)
    expectStrictlyIncreasing(keys)
  })

  test('re-keys a sibling that leaves no room before the next key', () => {
    const keys = siblingOrderKeys(['a', undefined, 'a!'])
    expect(new Set(keys).size).toBe(3)
    expectStrictlyIncreasing(keys)
  })

  test('suffixes the keys it makes up when asked to', () => {
    const keys = siblingOrderKeys(['!', undefined, undefined, '%'], { suffix: () => 'Q' })
    expect(keys[0]).toBe('!')
    expect(keys[3]).toBe('%')
    expect(keys[1].endsWith('Q')).toBe(true)
    expectStrictlyIncreasing(keys)
  })
})

describe('Figma keys containing spaces', () => {
  // Real Figma files use keys such as '&RQTOt7CO O'; the space sorts below the printable range.
  test('finds a key between a key and its space-extended successor', () => {
    expectBetween(orderKeyBetween('&RQTOt7CO', '&RQTOt7CO O'), '&RQTOt7CO', '&RQTOt7CO O')
  })

  test('keeps space-bearing imported keys and fits new layers between them', () => {
    const keys = siblingOrderKeys(['&RQTOt7CO', null, '&RQTOt7CO O', '&RQTOt7CO f', null])
    expect(keys[0]).toBe('&RQTOt7CO')
    expect(keys[2]).toBe('&RQTOt7CO O')
    expect(keys[3]).toBe('&RQTOt7CO f')
    expect(new Set(keys).size).toBe(keys.length)
    expectStrictlyIncreasing(keys)
  })
})
