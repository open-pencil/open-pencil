import { describe, expect, test } from 'bun:test'

import { chooseLocalFontMatch, findLocalFont, fontWeightMatchOrder } from '@open-pencil/core/text'

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

  test('takes the normal-width face of a weight over a width face', () => {
    const widths = [
      { family: 'Acme Sans', style: 'Condensed Semi Bold' },
      { family: 'Acme Sans', style: 'Compressed Regular' },
      { family: 'Acme Sans', style: 'Semi Bold' },
      { family: 'Acme Sans', style: 'Book' },
      { family: 'Acme Sans', style: 'Condensed Bold' }
    ]
    expect(chooseLocalFontMatch(widths, 'Acme Sans', 'SemiBold')?.style).toBe('Semi Bold')
    expect(chooseLocalFontMatch(widths, 'Acme Sans')?.style).toBe('Book')
    expect(chooseLocalFontMatch(widths, 'Acme Sans', 'Bold')?.style).toBe('Condensed Bold')
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

describe('findLocalFont', () => {
  const face = (family: string, style: string, fullName: string) => ({ family, style, fullName })
  const windows = [
    face('Acme Sans', 'Regular', 'Acme Sans Regular'),
    face('Acme Sans', 'Bold', 'Acme Sans Bold'),
    face('Acme Sans Compressed Medium', 'Regular', 'Acme Sans Compressed Medium'),
    face('Acme Sans Condensed', 'Bold', 'Acme Sans Condensed Bold')
  ]

  test('finds a face Windows lists as a family of its own by its full name', () => {
    expect(findLocalFont(windows, 'Acme Sans', 'Compressed Medium')?.family).toBe(
      'Acme Sans Compressed Medium'
    )
    expect(findLocalFont(windows, 'Acme Sans', 'Condensed Bold')?.family).toBe(
      'Acme Sans Condensed'
    )
  })

  test('keeps the face its own family lists, and finds none for a face nobody names', () => {
    expect(findLocalFont(windows, 'Acme Sans', 'Bold')?.fullName).toBe('Acme Sans Bold')
    expect(findLocalFont(windows, 'Acme Sans', 'Compressed Black')).toBeUndefined()
  })

  test('finds the face by the family name a variable family normalizes to', () => {
    expect(findLocalFont(windows, 'Acme Sans Variable', 'Compressed Medium')?.family).toBe(
      'Acme Sans Compressed Medium'
    )
  })
})
