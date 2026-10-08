import { describe, expect, test } from 'bun:test'

import { tokenNumberFromUnit, tokenNumberInUnit } from '@open-pencil/scene-graph'

describe('token units', () => {
  test('store rem as canvas pixels and read it back', () => {
    expect(tokenNumberFromUnit(1.5, 'rem')).toBe(24)
    expect(tokenNumberInUnit(24, 'rem')).toBe(1.5)
  })

  test('store every other unit as written', () => {
    expect(tokenNumberFromUnit(150, 'ms')).toBe(150)
    expect(tokenNumberInUnit(12, 'px')).toBe(12)
  })
})
