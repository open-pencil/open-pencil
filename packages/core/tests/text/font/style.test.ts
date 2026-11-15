import { describe, expect, test } from 'bun:test'

import { chooseLocalFontMatch, fontWeightMatchOrder } from '@open-pencil/core/text'

describe('chooseLocalFontMatch', () => {
  const fonts = [
    { family: 'Inter', style: 'Italic' },
    { family: 'Inter', style: 'Regular' },
    { family: 'Inter', style: 'Semi Bold' },
    { family: 'Inter', style: 'Bold Italic' }
  ]

  test('prefers parsed weight and slant over first family match', () => {
    expect(chooseLocalFontMatch(fonts, 'Inter', 'SemiBold')?.style).toBe('Semi Bold')
    expect(chooseLocalFontMatch(fonts, 'Inter', 'Regular')?.style).toBe('Regular')
  })

  test('does not substitute nearby weights for explicit style requests', () => {
    expect(chooseLocalFontMatch(fonts, 'Inter', 'Bold')).toBeUndefined()
  })

  test('finds a face named apart from its weight by that name, never another face of its weight', () => {
    const helvetica = [
      { family: 'Helvetica Neue', style: 'Regular' },
      { family: 'Helvetica Neue', style: 'Bold' },
      { family: 'Helvetica Neue', style: 'Condensed Bold' }
    ]
    expect(chooseLocalFontMatch(helvetica, 'Helvetica Neue', 'Condensed Bold')?.style).toBe(
      'Condensed Bold'
    )
    expect(chooseLocalFontMatch(helvetica, 'Helvetica Neue', 'Condensed Black')).toBeUndefined()
    expect(chooseLocalFontMatch(helvetica, 'Helvetica Neue', 'Book')).toBeUndefined()
  })

  test('without a style, takes the face CSS font matching picks for regular', () => {
    const faces = [
      { family: 'Inter', style: 'Black' },
      { family: 'Inter', style: 'Light Italic' },
      { family: 'Inter', style: 'Medium' },
      { family: 'Inter', style: 'Light' }
    ]
    // Regular falls to medium before lighter weights, and the upright slant before italic.
    expect(chooseLocalFontMatch(faces, 'Inter')?.style).toBe('Medium')
    expect(chooseLocalFontMatch(faces.slice(0, 2), 'Inter')?.style).toBe('Black')
  })
})

describe('fontWeightMatchOrder', () => {
  test('tries weights in CSS font matching order', () => {
    expect(fontWeightMatchOrder(400)).toEqual([400, 500, 300, 200, 100, 600, 700, 800, 900])
    expect(fontWeightMatchOrder(700)).toEqual([700, 800, 900, 600, 500, 400, 300, 200, 100])
    expect(fontWeightMatchOrder(300)).toEqual([300, 200, 100, 400, 500, 600, 700, 800, 900])
  })
})
