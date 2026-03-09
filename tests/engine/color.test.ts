import { describe, test, expect } from 'bun:test'

import {
  parseColor,
  normalizeColor,
  colorToHex,
  colorToHex8,
  colorToHexRaw,
  colorToRgba255,
  colorToCSS,
  colorToCSSCompact,
  rgba255ToColor,
  colorToFill,
  colorDistance
} from '@open-pencil/core'

describe('parseColor', () => {
  test('hex 6-digit', () => {
    const c = parseColor('#FF0000')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(0)
    expect(c.a).toBe(1)
  })

  test('hex 3-digit', () => {
    const c = parseColor('#f00')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(0)
  })

  test('hex 8-digit with alpha', () => {
    const c = parseColor('#FF000080')
    expect(c.r).toBeCloseTo(1)
    expect(c.a).toBeCloseTo(0.5, 1)
  })

  test('rgb()', () => {
    const c = parseColor('rgb(255, 0, 0)')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(0)
    expect(c.a).toBe(1)
  })

  test('rgba()', () => {
    const c = parseColor('rgba(255, 0, 0, 0.5)')
    expect(c.r).toBeCloseTo(1)
    expect(c.a).toBeCloseTo(0.5)
  })

  test('named color', () => {
    const c = parseColor('blue')
    expect(c.b).toBeCloseTo(1)
    expect(c.r).toBeCloseTo(0)
    expect(c.a).toBe(1)
  })

  test('white', () => {
    const c = parseColor('#FFFFFF')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(1)
    expect(c.b).toBeCloseTo(1)
  })

  test('invalid returns black fallback', () => {
    const c = parseColor('invalid')
    expect(c.r).toBe(0)
    expect(c.g).toBe(0)
    expect(c.b).toBe(0)
    expect(c.a).toBe(1)
  })

  test('empty string returns black fallback', () => {
    const c = parseColor('')
    expect(c.r).toBe(0)
    expect(c.g).toBe(0)
    expect(c.b).toBe(0)
  })
})

describe('normalizeColor', () => {
  test('undefined returns black', () => {
    const c = normalizeColor()
    expect(c).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('partial fills defaults', () => {
    const c = normalizeColor({ r: 0.5 })
    expect(c).toEqual({ r: 0.5, g: 0, b: 0, a: 1 })
  })

  test('full color passes through', () => {
    const c = normalizeColor({ r: 0.1, g: 0.2, b: 0.3, a: 0.4 })
    expect(c).toEqual({ r: 0.1, g: 0.2, b: 0.3, a: 0.4 })
  })
})

describe('colorToHex', () => {
  test('red', () => {
    expect(colorToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#FF0000')
  })

  test('black', () => {
    expect(colorToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000')
  })

  test('white', () => {
    expect(colorToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#FFFFFF')
  })
})

describe('colorToHex8', () => {
  test('opaque returns 6-char hex', () => {
    expect(colorToHex8({ r: 1, g: 0, b: 0, a: 1 })).toBe('#FF0000')
  })

  test('semi-transparent returns 8-char hex', () => {
    const hex = colorToHex8({ r: 1, g: 0, b: 0, a: 0.5 })
    expect(hex).toMatch(/^#[0-9A-F]{8}$/)
    expect(hex.slice(0, 7)).toBe('#FF0000')
  })

  test('alpha override', () => {
    const hex = colorToHex8({ r: 1, g: 0, b: 0, a: 1 }, 0.5)
    expect(hex).toMatch(/^#FF0000[0-9A-F]{2}$/)
  })

  test('alpha=0 returns 8-char hex', () => {
    expect(colorToHex8({ r: 1, g: 0, b: 0, a: 0 })).toBe('#FF000000')
  })

  test('uppercase', () => {
    const hex = colorToHex8({ r: 0.8, g: 0.6, b: 0.1, a: 0.5 })
    expect(hex).toBe(hex.toUpperCase())
  })
})

describe('colorToHexRaw', () => {
  test('strips # prefix', () => {
    expect(colorToHexRaw({ r: 1, g: 0, b: 0, a: 1 })).toBe('FF0000')
  })
})

describe('colorToRgba255', () => {
  test('converts 0-1 to 0-255', () => {
    const result = colorToRgba255({ r: 1, g: 0.5, b: 0, a: 0.8 })
    expect(result.r).toBe(255)
    expect(result.g).toBe(128)
    expect(result.b).toBe(0)
    expect(result.a).toBe(0.8)
  })
})

describe('colorToCSS', () => {
  test('opaque uses rgb()', () => {
    const result = colorToCSS({ r: 1, g: 0, b: 0, a: 1 })
    expect(result).toBe('rgb(255, 0, 0)')
  })

  test('transparent uses rgba()', () => {
    const result = colorToCSS({ r: 1, g: 0, b: 0, a: 0.5 })
    expect(result).toBe('rgba(255, 0, 0, 0.5)')
  })
})

describe('colorToCSSCompact', () => {
  test('no spaces between values', () => {
    const result = colorToCSSCompact({ r: 1, g: 0, b: 0, a: 0.5 })
    expect(result).toBe('rgba(255,0,0,0.5)')
  })

  test('opaque omits alpha', () => {
    const result = colorToCSSCompact({ r: 1, g: 0, b: 0, a: 1 })
    expect(result).toBe('rgb(255,0,0)')
  })
})

describe('rgba255ToColor', () => {
  test('converts 255-scale to 0-1', () => {
    const c = rgba255ToColor(255, 128, 0, 0.5)
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(0.502, 2)
    expect(c.b).toBe(0)
    expect(c.a).toBe(0.5)
  })

  test('alpha defaults to 1', () => {
    const c = rgba255ToColor(0, 0, 0)
    expect(c.a).toBe(1)
  })
})

describe('colorToFill', () => {
  test('from Color object', () => {
    const fill = colorToFill({ r: 1, g: 0, b: 0, a: 0.5 })
    expect(fill.type).toBe('SOLID')
    expect(fill.color.r).toBe(1)
    expect(fill.opacity).toBe(0.5)
    expect(fill.visible).toBe(true)
  })

  test('from hex string', () => {
    const fill = colorToFill('#ff0000')
    expect(fill.type).toBe('SOLID')
    expect(fill.color.r).toBeCloseTo(1)
    expect(fill.color.g).toBeCloseTo(0)
  })
})

describe('colorDistance', () => {
  test('identical colors have zero distance', () => {
    const c = { r: 0.5, g: 0.3, b: 0.1, a: 1 }
    expect(colorDistance(c, c)).toBe(0)
  })

  test('black to white is ~441', () => {
    const d = colorDistance({ r: 0, g: 0, b: 0, a: 1 }, { r: 1, g: 1, b: 1, a: 1 })
    expect(d).toBeCloseTo(441.67, 0)
  })

  test('similar reds are close', () => {
    const d = colorDistance(
      { r: 1, g: 0, b: 0, a: 1 },
      { r: 0.95, g: 0.02, b: 0.02, a: 1 }
    )
    expect(d).toBeLessThan(15)
  })

  test('red to blue is far', () => {
    const d = colorDistance(
      { r: 1, g: 0, b: 0, a: 1 },
      { r: 0, g: 0, b: 1, a: 1 }
    )
    expect(d).toBeGreaterThan(300)
  })
})
