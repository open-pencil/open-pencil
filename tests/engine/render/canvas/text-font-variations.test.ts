import { describe, expect, test } from 'bun:test'

import {
  textDecorationStyleValue,
  textFontFeatures,
  textFontVariations,
  textHeightBehaviorValue
} from '#core/canvas/text'

describe('canvas text font variations', () => {
  test('maps imported text decoration styles to CanvasKit', () => {
    const ck = {
      DecorationStyle: {
        Solid: 'solid',
        Dotted: 'dotted',
        Wavy: 'wavy'
      }
    }

    expect(textDecorationStyleValue(ck, 'SOLID')).toBe('solid')
    expect(textDecorationStyleValue(ck, 'DOTTED')).toBe('dotted')
    expect(textDecorationStyleValue(ck, 'WAVY')).toBe('wavy')
    expect(textDecorationStyleValue(ck, undefined)).toBe('solid')
  })

  test('maps imported leading trim to CanvasKit text height behavior', () => {
    const ck = {
      TextHeightBehavior: {
        DisableAll: 'disable-all'
      }
    }

    expect(textHeightBehaviorValue(ck, 'CAP_HEIGHT')).toBe('disable-all')
    expect(textHeightBehaviorValue(ck, 'NONE')).toBeUndefined()
  })

  test('passes imported variable font axes to CanvasKit text styles', () => {
    expect(
      textFontVariations([
        { axis: 'wght', value: 650 },
        { axis: 'wdth', value: 88 }
      ])
    ).toEqual([
      { axis: 'wght', value: 650 },
      { axis: 'wdth', value: 88 }
    ])
  })

  test('omits font variations when no axes are set', () => {
    expect(textFontVariations([])).toBeUndefined()
    expect(textFontVariations(undefined)).toBeUndefined()
  })

  test('passes imported OpenType feature toggles to CanvasKit text styles', () => {
    expect(
      textFontFeatures([
        { tag: 'LIGA', enabled: false },
        { tag: 'CALT', enabled: true },
        { tag: 'SS01', enabled: true }
      ])
    ).toEqual([
      { name: 'liga', value: 0 },
      { name: 'calt', value: 1 },
      { name: 'ss01', value: 1 }
    ])
  })

  test('omits font features when no toggles are set', () => {
    expect(textFontFeatures([])).toBeUndefined()
    expect(textFontFeatures(undefined)).toBeUndefined()
  })
})
