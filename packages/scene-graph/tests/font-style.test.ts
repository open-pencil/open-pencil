import { describe, expect, test } from 'bun:test'

import {
  faceLoadKey,
  faceStyleKey,
  namesWeight,
  normalizeFontFamily,
  standardStyleName,
  styleToWeight
} from '@open-pencil/scene-graph/font-style'

describe('styleToWeight', () => {
  test('maps common style names', () => {
    expect(styleToWeight('Regular')).toBe(400)
    expect(styleToWeight('Bold')).toBe(700)
    expect(styleToWeight('Light')).toBe(300)
    expect(styleToWeight('Thin')).toBe(100)
    expect(styleToWeight('Medium')).toBe(500)
    expect(styleToWeight('SemiBold')).toBe(600)
    expect(styleToWeight('Semi Bold')).toBe(600)
    expect(styleToWeight('DemiBold')).toBe(600)
    expect(styleToWeight('ExtraBold')).toBe(800)
    expect(styleToWeight('Black')).toBe(900)
  })

  test('handles italic variants', () => {
    expect(styleToWeight('Bold Italic')).toBe(700)
    expect(styleToWeight('Light Italic')).toBe(300)
    expect(styleToWeight('600 Italic')).toBe(600)
  })

  test('case insensitive', () => {
    expect(styleToWeight('bold')).toBe(700)
    expect(styleToWeight('THIN')).toBe(100)
    expect(styleToWeight('semibold')).toBe(600)
  })
})

describe('faceLoadKey', () => {
  test('maps weights to style names', () => {
    expect(faceLoadKey(100)).toBe('Thin')
    expect(faceLoadKey(200)).toBe('ExtraLight')
    expect(faceLoadKey(300)).toBe('Light')
    expect(faceLoadKey(400)).toBe('Regular')
    expect(faceLoadKey(500)).toBe('Medium')
    expect(faceLoadKey(600)).toBe('SemiBold')
    expect(faceLoadKey(700)).toBe('Bold')
    expect(faceLoadKey(800)).toBe('ExtraBold')
    expect(faceLoadKey(900)).toBe('Black')
  })

  test('appends Italic suffix', () => {
    expect(faceLoadKey(400, true)).toBe('Regular Italic')
    expect(faceLoadKey(700, true)).toBe('Bold Italic')
  })
})

describe('standardStyleName', () => {
  test('names faces as Google Fonts does, and the regular italic "Italic"', () => {
    expect(standardStyleName(200)).toBe('ExtraLight')
    expect(standardStyleName(600)).toBe('SemiBold')
    expect(standardStyleName(600, true)).toBe('SemiBold Italic')
    expect(standardStyleName(400, true)).toBe('Italic')
    expect(standardStyleName(450)).toBe('Medium')
  })
})

describe('normalizeFontFamily', () => {
  test('strips " Variable" suffix', () => {
    expect(normalizeFontFamily('Inter Variable')).toBe('Inter')
    expect(normalizeFontFamily('Roboto Flex Variable')).toBe('Roboto Flex')
  })

  test('case insensitive', () => {
    expect(normalizeFontFamily('Inter VARIABLE')).toBe('Inter')
    expect(normalizeFontFamily('Inter variable')).toBe('Inter')
  })

  test('handles extra whitespace before Variable', () => {
    expect(normalizeFontFamily('Inter  Variable')).toBe('Inter')
  })

  test('returns unchanged when no Variable suffix', () => {
    expect(normalizeFontFamily('Inter')).toBe('Inter')
    expect(normalizeFontFamily('Roboto')).toBe('Roboto')
    expect(normalizeFontFamily('')).toBe('')
  })

  test('does not strip Variable in the middle', () => {
    expect(normalizeFontFamily('Variable Sans')).toBe('Variable Sans')
  })

  test('strips optical size suffix (pt)', () => {
    expect(normalizeFontFamily('DM Sans 9pt')).toBe('DM Sans')
    expect(normalizeFontFamily('DM Sans 14pt')).toBe('DM Sans')
  })

  test('strips optical size suffix (px)', () => {
    expect(normalizeFontFamily('Noto Sans 12px')).toBe('Noto Sans')
  })

  test('strips optical size suffix (em)', () => {
    expect(normalizeFontFamily('Custom Font 1em')).toBe('Custom Font')
  })

  test('does not strip size units in the middle', () => {
    expect(normalizeFontFamily('12pt Serif')).toBe('12pt Serif')
  })
})

describe('faceStyleKey', () => {
  const face = (fontWeight: number, fontStyle: string | null, italic = false) =>
    faceStyleKey({ fontWeight, italic, fontStyle })

  test('loads a face its weight already names by the weight, however its name is spelled', () => {
    expect(face(600, null)).toBe('SemiBold')
    expect(face(600, 'Semi Bold')).toBe('SemiBold')
    expect(face(400, 'Italic', true)).toBe('Regular Italic')
    expect(face(700, 'bold')).toBe('Bold')
  })

  test('loads a face its weight cannot pick by its own name', () => {
    expect(face(350, 'Book')).toBe('Book')
    expect(face(400, 'Roman')).toBe('Roman')
    expect(face(800, 'Heavy')).toBe('Heavy')
    expect(face(700, 'Condensed Bold')).toBe('Condensed Bold')
    expect(face(450, 'Retina')).toBe('Retina')
  })
})

describe('namesWeight', () => {
  test('tells names of a weight and slant from names of a face of their own', () => {
    for (const name of ['Regular', 'Italic', 'Regular Italic', 'Semi Bold', 'ExtraBold Italic'])
      expect(namesWeight(name)).toBe(true)
    for (const name of ['Book', 'Roman', 'Heavy', 'Oblique', 'Condensed Bold', 'Retina'])
      expect(namesWeight(name)).toBe(false)
  })
})
