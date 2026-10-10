import { describe, expect, test } from 'bun:test'

import { expectFills } from '#core-tests/helpers/assert'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import type { Color } from '@open-pencil/scene-graph'

// Results recorded from the same scripts run in live Figma (2026-10-11). OpenPencil reports
// lengths in pixels, as its node getters do, and paints in the shape `fills` returns.
function styledText(characters = 'Hello world\nSecond') {
  const api = new FigmaAPI(new SceneGraph())
  const text = api.createText()
  text.characters = characters
  return { api, text }
}

const REGULAR = { family: 'Inter', style: 'Regular' }
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 }
const BOLD = { family: 'Inter', style: 'Bold' }

describe('styled text segments', () => {
  test('split only where a requested field changes', () => {
    const { text } = styledText()
    text.setRangeFontSize(0, 5, 24)
    text.setRangeFontName(6, 11, BOLD)

    expect(text.getStyledTextSegments(['fontSize'])).toEqual([
      { characters: 'Hello', start: 0, end: 5, fontSize: 24 },
      { characters: ' world\nSecond', start: 5, end: 18, fontSize: 12 }
    ])
    expect(text.getStyledTextSegments(['fontSize', 'fontName'])).toEqual([
      { characters: 'Hello', start: 0, end: 5, fontSize: 24, fontName: REGULAR },
      { characters: ' ', start: 5, end: 6, fontSize: 12, fontName: REGULAR },
      { characters: 'world\n', start: 6, end: 12, fontSize: 12, fontName: BOLD },
      { characters: 'Second', start: 12, end: 18, fontSize: 12, fontName: REGULAR }
    ])
    expect(text.getStyledTextSegments(['fontSize'], 3, 8)).toEqual([
      { characters: 'lo', start: 3, end: 5, fontSize: 24 },
      { characters: ' wo', start: 5, end: 8, fontSize: 12 }
    ])
  })

  test('style a newline as the character before it', () => {
    const sizes = (start: number, end: number) => {
      const { text } = styledText('Hello world\nSecond\nThird')
      text.setRangeFontSize(start, end, 30)
      return text
        .getStyledTextSegments(['fontSize'])
        .map((segment) => [segment.start, segment.end, segment.fontSize])
    }
    expect(sizes(6, 11)).toEqual([
      [0, 6, 12],
      [6, 12, 30],
      [12, 24, 12]
    ])
    expect(sizes(6, 10)).toEqual([
      [0, 6, 12],
      [6, 10, 30],
      [10, 24, 12]
    ])
    expect(sizes(13, 18)).toEqual([
      [0, 13, 12],
      [13, 19, 30],
      [19, 24, 12]
    ])
    expect(sizes(11, 12)).toEqual([[0, 24, 12]])
  })

  test('read every field Figma lists, with its defaults for unstyled text', () => {
    const { text } = styledText('Abc')
    const [segment] = text.getStyledTextSegments([
      'fontStyle',
      'textDecorationStyle',
      'textDecorationColor',
      'textCase',
      'lineHeight',
      'hyperlink',
      'textStyleId',
      'fillStyleId',
      'listOptions',
      'indentation',
      'openTypeFeatures',
      'boundVariables',
      'textStyleOverrides',
      'textWrapStyle'
    ])
    expect(segment).toEqual({
      characters: 'Abc',
      start: 0,
      end: 3,
      fontStyle: 'REGULAR',
      textDecorationStyle: null,
      textDecorationColor: null,
      textCase: 'ORIGINAL',
      lineHeight: { unit: 'AUTO' },
      hyperlink: null,
      textStyleId: '',
      fillStyleId: '',
      listOptions: { type: 'NONE' },
      indentation: 0,
      openTypeFeatures: {},
      boundVariables: {},
      textStyleOverrides: [],
      textWrapStyle: 'AUTO'
    })
  })

  test('reject what Figma rejects, with its messages', () => {
    const { text } = styledText('Abc')
    expect(() => text.getStyledTextSegments(['fontSize'], 2, 2)).toThrow(
      "in getStyledTextSegments: Empty range selected. 'end' must be greater than 'start'"
    )
    expect(() => text.getStyledTextSegments(['fontSize'], 2)).toThrow(
      "in getStyledTextSegments: Invalid range. Must provide both 'start' and 'end'"
    )
    expect(() => text.getStyledTextSegments(['nope' as 'fontSize'])).toThrow(
      `in getStyledTextSegments: Property "getStyledTextSegments" failed validation: Invalid enum value. Expected 'fontSize' | 'fontName'`
    )
    expect(styledText('').text.getStyledTextSegments(['fontSize'])).toEqual([])
  })
})

describe('character style ranges', () => {
  test('read mixed on the node once ranges differ, and setting the node restyles every character', () => {
    const { api, text } = styledText()
    text.setRangeFontSize(0, 5, 24)
    text.setRangeFontName(6, 11, BOLD)
    expect<unknown>(text.fontSize).toBe(api.mixed)
    expect<unknown>(text.fontName).toBe(api.mixed)
    expect(text.getRangeFontSize(0, 8)).toBe(api.mixed)
    expect(text.getRangeFontWeight(6, 7)).toBe(700)
    expect(text.getRangeAllFontNames(0, 18)).toEqual([REGULAR, BOLD])

    text.fontSize = 13
    expect(text.getStyledTextSegments(['fontSize', 'fontName'])).toEqual([
      { characters: 'Hello ', start: 0, end: 6, fontSize: 13, fontName: REGULAR },
      { characters: 'world\n', start: 6, end: 12, fontSize: 13, fontName: BOLD },
      { characters: 'Second', start: 12, end: 18, fontSize: 13, fontName: REGULAR }
    ])
  })

  test('fill text ranges, and read the node mixed until it is filled again', () => {
    const { api, text } = styledText('Abc')
    const red = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0 } }
    text.setRangeFills(0, 1, [red])
    expect(expectFills(text.getRangeFills(0, 1) as never)[0]).toMatchObject({
      color: { r: 1, g: 0, b: 0 }
    })
    expect<unknown>(text.fills).toBe(api.mixed)
    text.fills = [{ type: 'SOLID', color: BLUE, opacity: 1, visible: true }]
    expect(
      text.getStyledTextSegments(['fills']).map((segment) => [segment.start, segment.end])
    ).toEqual([[0, 3]])
    expect(expectFills(text.fills)[0]).toMatchObject({ color: { r: 0, g: 0, b: 1 } })
  })

  test('take letter spacing and line height in pixels or percent of the font size', () => {
    const { api, text } = styledText('Abc')
    text.fontSize = 20
    text.setRangeLetterSpacing(0, 1, { value: 10, unit: 'PERCENT' })
    expect(text.getRangeLetterSpacing(0, 1)).toEqual({ unit: 'PIXELS', value: 2 })
    expect<unknown>(text.letterSpacing).toBe(api.mixed)
    text.setRangeLineHeight(0, 2, { value: 150, unit: 'PERCENT' })
    expect(text.getRangeLineHeight(0, 1)).toEqual({ unit: 'PIXELS', value: 30 })
    text.setRangeLineHeight(0, 2, { unit: 'AUTO' })
    expect(text.getRangeLineHeight(0, 1)).toEqual({ unit: 'AUTO' })
  })

  test('style decorations of underlined ranges only, keeping them when the underline returns', () => {
    const { text } = styledText('Abc def')
    text.setRangeTextDecoration(0, 3, 'UNDERLINE')
    text.setRangeTextDecoration(4, 7, 'STRIKETHROUGH')
    expect([
      text.getRangeTextDecorationStyle(0, 3),
      text.getRangeTextDecorationOffset(0, 3),
      text.getRangeTextDecorationThickness(0, 3),
      text.getRangeTextDecorationColor(0, 3),
      text.getRangeTextDecorationSkipInk(0, 3)
    ]).toEqual(['SOLID', { unit: 'AUTO' }, { unit: 'AUTO' }, { value: 'AUTO' }, true])
    // A struck-through range has no underline to style.
    expect(text.getRangeTextDecorationStyle(4, 7)).toBeNull()
    expect(() => text.setRangeTextDecorationStyle(4, 7, 'WAVY')).toThrow(
      'in setRangeTextDecorationStyle: Cannot set text decoration style on a non-underlined text range'
    )

    text.setRangeTextDecorationStyle(0, 3, 'WAVY')
    text.setRangeTextDecorationOffset(0, 3, { value: -2, unit: 'PIXELS' })
    text.setRangeTextDecorationThickness(0, 3, { value: 2, unit: 'PIXELS' })
    text.setRangeTextDecorationSkipInk(0, 3, false)
    text.setRangeTextDecorationColor(0, 3, {
      value: { type: 'SOLID', color: { r: 0, g: 1, b: 0 } }
    })
    expect(text.getRangeTextDecorationOffset(0, 3)).toEqual({ unit: 'PIXELS', value: -2 })
    expect(text.getRangeTextDecorationColor(0, 3)).toMatchObject({
      value: { color: { r: 0, g: 1, b: 0 } }
    })
    text.setRangeTextDecoration(0, 3, 'NONE')
    expect(text.getRangeTextDecorationSkipInk(0, 3)).toBeNull()
    text.setRangeTextDecoration(0, 3, 'UNDERLINE')
    expect([
      text.getRangeTextDecorationStyle(0, 3),
      text.getRangeTextDecorationThickness(0, 3),
      text.getRangeTextDecorationSkipInk(0, 3)
    ]).toEqual(['WAVY', { unit: 'PIXELS', value: 2 }, false])
    text.setRangeTextDecorationColor(0, 3, { value: 'AUTO' })
    expect(text.getRangeTextDecorationColor(0, 3)).toEqual({ value: 'AUTO' })
  })

  test('reject what Figma rejects, with its messages', () => {
    const { text } = styledText('Abc')
    const message = (method: string, problem: string) =>
      `in ${method}: Property "value" failed validation: ${problem}`
    expect(() => text.setRangeFontSize(0, 1, 0)).toThrow(
      message('setRangeFontSize', 'Number must be greater than or equal to 1')
    )
    expect(() => text.setRangeFontSize(0, 1, Number.NaN)).toThrow(
      message('setRangeFontSize', 'Expected number, received nan')
    )
    // The range is checked before the value.
    expect(() => text.setRangeFontSize(5, 9, 0)).toThrow(
      'in setRangeFontSize: Range outside of available characters.'
    )
    expect(() =>
      text.setRangeLetterSpacing(0, 1, { value: 1, unit: 'EM' as 'PIXELS' })
    ).toThrow(
      message(
        'setRangeLetterSpacing',
        "Invalid enum value. Expected 'PIXELS' | 'PERCENT', received 'EM' at .unit"
      )
    )
    expect(() => text.setRangeLineHeight(0, 1, { value: 1, unit: 'EM' as 'PIXELS' })).toThrow(
      message(
        'setRangeLineHeight',
        "Invalid discriminator value. Expected 'PIXELS' | 'PERCENT' | 'AUTO' at .unit"
      )
    )
    expect(() =>
      text.setRangeFills(0, 1, [{ type: 'SOLID', color: { r: 2, g: 0, b: 0 } }])
    ).toThrow(message('setRangeFills', 'Number must be less than or equal to 1 at [0].color.r'))
    expect(() => text.setRangeTextDecoration(0, 1, 'OVERLINE' as 'NONE')).toThrow(
      message(
        'setRangeTextDecoration',
        "Invalid enum value. Expected 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH', received 'OVERLINE'"
      )
    )
    text.setRangeTextDecoration(0, 3, 'UNDERLINE')
    expect(() => text.setRangeTextDecorationSkipInk(0, 1, 'yes' as never)).toThrow(
      message('setRangeTextDecorationSkipInk', 'Expected boolean, received string')
    )
  })
})
