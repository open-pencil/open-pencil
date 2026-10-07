import { describe, expect, test } from 'bun:test'

import { parseCSSColor, parseCSSNumber } from '@open-pencil/scene-graph/css'

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
