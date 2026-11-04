import { describe, expect, test } from 'bun:test'

import { contentInsets, hasBorder } from '#dom-css/import/box'

describe('border sides', () => {
  test('a side that draws no border adds no inset, whatever its width', () => {
    const insets = contentInsets({
      padding: '10px',
      'border-top-style': 'none',
      'border-bottom-style': 'solid',
      'border-top-width': '5px',
      'border-bottom-width': '2px'
    })
    expect([insets.top, insets.bottom]).toEqual([10, 12])
  })

  test('the border-style shorthand gives each side its value, as CSS does', () => {
    const insets = contentInsets({ 'border-style': 'solid none', 'border-width': '4px' })
    expect(insets).toEqual({ top: 4, right: 0, bottom: 4, left: 0 })
    expect(contentInsets({ 'border-style': 'none none dashed', 'border-width': '4px' })).toEqual({
      top: 0,
      right: 0,
      bottom: 4,
      left: 0
    })
    expect(hasBorder({ 'border-style': 'none hidden' })).toBe(false)
    expect(hasBorder({ 'border-style': 'none none none solid' })).toBe(true)
  })
})
