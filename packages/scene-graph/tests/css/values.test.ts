import { describe, expect, test } from 'bun:test'

import {
  parseCSSColor,
  parseCSSNumber,
  parseCSSURLReferences,
  parseFragmentReference
} from '@open-pencil/scene-graph/css'

describe('parseCSSNumber', () => {
  test.each([
    ['12', 12],
    ['12px', 12],
    [' -4.5PX ', -4.5],
    ['0.75rem', 12],
    ['.5', 0.5]
  ])('reads %p as %p pixels', (value, pixels) => {
    expect(parseCSSNumber(value)).toBe(pixels)
  })

  test.each([undefined, '', 'auto', '50%', '1.5em', '10vh', 'calc(1px + 2px)', 'abc'])(
    'reads no pixels from %p',
    (value) => {
      expect(parseCSSNumber(value)).toBeNull()
    }
  )
})

describe('parseCSSColor', () => {
  test('reads a color', () => {
    expect(parseCSSColor(' #ff0000 ')).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  })

  test.each([undefined, '', 'nope', 'transparent', 'rgba(0, 0, 0, 0)', 'rgb(0 0 0 / 0)', '#0000'])(
    'reads no color from %p, which paints nothing',
    (value) => {
      expect(parseCSSColor(value)).toBeNull()
    }
  )
})

describe('parseFragmentReference', () => {
  test('reads the id a reference points to in its own document, decoded', () => {
    expect(parseFragmentReference('#mark')).toBe('mark')
    expect(parseFragmentReference(' #a%20b ')).toBe('a b')
  })

  test('refuses a reference to another file or without an id', () => {
    expect(parseFragmentReference('sprite.svg#icon')).toBeNull()
    expect(parseFragmentReference('https://example.test/a.svg#icon')).toBeNull()
    expect(parseFragmentReference('?v=2#icon')).toBeNull()
    expect(parseFragmentReference('#')).toBeNull()
    expect(parseFragmentReference(undefined)).toBeNull()
  })
})

describe('parseCSSURLReferences', () => {
  test("lists a value's local url() ids, quoted or not, and leaves out other files", () => {
    expect(parseCSSURLReferences('url(#clip) url("#mask%201") url(other.svg#x)')).toEqual([
      'clip',
      'mask 1'
    ])
  })
})
