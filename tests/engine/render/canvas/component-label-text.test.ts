import { describe, expect, test } from 'bun:test'

import { ellipsizeLabelText } from '#core/canvas/labels/text'

import { asDouble } from './helpers'

const fixedWidthFont = asDouble<Parameters<typeof ellipsizeLabelText>[0]>({
  getGlyphIDs(text: string) {
    return [...text].map((_, index) => index)
  },
  getGlyphWidths(glyphs: number[]) {
    return glyphs.map(() => 10)
  }
})

describe('label text', () => {
  test('keeps labels that fit inside the component width', () => {
    expect(ellipsizeLabelText(fixedWidthFont, 'Button', 60)).toBe('Button')
  })

  test('ellipsizes labels that exceed the component width', () => {
    expect(ellipsizeLabelText(fixedWidthFont, 'Very long component', 55)).toBe('Very…')
  })

  test('returns only ellipsis when only the ellipsis fits', () => {
    expect(ellipsizeLabelText(fixedWidthFont, 'Component', 10)).toBe('…')
  })
})
