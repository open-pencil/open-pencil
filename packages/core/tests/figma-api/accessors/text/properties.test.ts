import { beforeAll, describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'
beforeAll(async () => {
  await registerTestFont('Inter')
  await registerTestFont('Roboto')
})

describe('text', () => {
  test('characters maps to text content', () => {
    const api = createAPI()
    const text = api.createText()
    text.characters = 'Hello World'
    expect(text.characters).toBe('Hello World')
  })

  test('fontSize get/set', () => {
    const api = createAPI()
    const text = api.createText()
    text.fontSize = 24
    expect(text.fontSize).toBe(24)
  })

  test('fontName get/set', async () => {
    const api = createAPI()
    const text = api.createText()
    await api.loadFontAsync({ family: 'Roboto', style: 'Bold' })
    text.fontName = { family: 'Roboto', style: 'Bold' }
    expect(text.fontName.family).toBe('Roboto')
    expect(text.fontWeight).toBe(700)
  })

  test('fontName italic', async () => {
    const api = createAPI()
    const text = api.createText()
    await api.loadFontAsync({ family: 'Inter', style: 'Bold Italic' })
    text.fontName = { family: 'Inter', style: 'Bold Italic' }
    expect(text.fontName.family).toBe('Inter')
    expect(text.fontWeight).toBe(700)
    expect(text.fontName.style).toBe('Bold Italic')
  })

  test('textAlignHorizontal', () => {
    const api = createAPI()
    const text = api.createText()
    text.textAlignHorizontal = 'CENTER'
    expect(text.textAlignHorizontal).toBe('CENTER')
  })

  test('textAutoResize', () => {
    const api = createAPI()
    const text = api.createText()
    text.textAutoResize = 'WIDTH_AND_HEIGHT'
    expect(text.textAutoResize).toBe('WIDTH_AND_HEIGHT')
  })
})

describe('text extras', () => {
  test('textTruncation', () => {
    const api = createAPI()
    const text = api.createText()
    expect(text.textTruncation).toBe('DISABLED')
    text.textTruncation = 'ENDING'
    expect(text.textTruncation).toBe('ENDING')
  })

  test('autoRename', () => {
    const api = createAPI()
    const text = api.createText()
    expect(text.autoRename).toBe(true)
    text.autoRename = false
    expect(text.autoRename).toBe(false)
  })

  test('insertCharacters', () => {
    const api = createAPI()
    const text = api.createText()
    text.characters = 'Hello World'
    text.insertCharacters(5, ' Beautiful')
    expect(text.characters).toBe('Hello Beautiful World')
  })

  test('deleteCharacters', () => {
    const api = createAPI()
    const text = api.createText()
    text.characters = 'Hello Beautiful World'
    text.deleteCharacters(5, 15)
    expect(text.characters).toBe('Hello World')
  })
})

// Measured with the same scripts in Figma's plugin API (Figma desktop 126).
describe('text setters check their values as Figma does', () => {
  test('font size, decoration, case, and font name', async () => {
    const api = createAPI()
    await api.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const text = api.createText()
    text.characters = 'Hello'
    const message = (property: string, problem: string) =>
      `in set_${property}: Property "${property}" failed validation: ${problem}`
    expect(() => (text.fontSize = 'a' as never)).toThrow(
      message('fontSize', 'Expected number, received string')
    )
    expect(() => (text.fontSize = 0)).toThrow(
      message('fontSize', 'Too small: expected number to be >=1')
    )
    expect(() => (text.fontSize = Number.NaN)).toThrow(
      message('fontSize', 'Expected number, received NaN')
    )
    expect(() => (text.textDecoration = 'OVER' as never)).toThrow(
      message(
        'textDecoration',
        'Invalid option: expected one of "NONE"|"UNDERLINE"|"STRIKETHROUGH"'
      )
    )
    expect(() => (text.textCase = 'SHOUT' as never)).toThrow(
      message(
        'textCase',
        'Invalid option: expected one of "ORIGINAL"|"UPPER"|"LOWER"|"TITLE"|"SMALL_CAPS"|"SMALL_CAPS_FORCED"'
      )
    )
    expect(() => (text.fontName = { family: 3 } as never)).toThrow(
      message('fontName', 'Expected string, received number at .family')
    )
    expect(() => (text.hyperlink = { type: 'X', value: 'a' } as never)).toThrow(
      'in set_hyperlink: Property "value" failed validation: Expected one of the following, but none matched:\n' +
        '  Invalid option: expected one of "URL"|"NODE" at .type\n  Expected null, received object'
    )
    expect([text.fontSize, text.textDecoration, text.textCase]).toEqual([12, 'NONE', 'ORIGINAL'])
  })

  test('spacings take finite numbers of 0 or more', async () => {
    const api = createAPI()
    await api.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const text = api.createText()
    text.characters = 'ab'
    const message = (property: string, problem: string) =>
      `in set_${property}: Property "${property}" failed validation: ${problem}`
    expect(() => (text.paragraphSpacing = 'a' as never)).toThrow(
      message('paragraphSpacing', 'Expected number, received string')
    )
    expect(() => (text.paragraphSpacing = Number.NaN)).toThrow(
      message('paragraphSpacing', 'Expected number, received NaN')
    )
    expect(() => (text.listSpacing = Infinity)).toThrow(
      message('listSpacing', 'Expected number, received Infinity')
    )
    expect(() => text.setRangeParagraphSpacing(0, 1, 'a' as never)).toThrow(
      'in setRangeParagraphSpacing: Property "value" failed validation: Expected number, received string'
    )
  })

  test('links and list options take no keys Figma does not know, and a level is whole first', async () => {
    const api = createAPI()
    await api.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const text = api.createText()
    text.characters = 'Hello'
    expect(() =>
      text.setRangeHyperlink(0, 3, { type: 'URL', value: 'https://a.com', foo: 1 } as never)
    ).toThrow(
      'in setRangeHyperlink: Property "hyperlink" failed validation: Unrecognized key: "foo"'
    )
    expect(() => text.setRangeHyperlink(0, 3, undefined as never)).toThrow(
      'failed validation: Expected one of the following, but none matched:\n  Required value missing'
    )
    expect(() => text.setRangeListOptions(0, 3, { type: 'NONE', foo: 1 } as never)).toThrow(
      'in setRangeListOptions: Property "options" failed validation: Unrecognized key: "foo"'
    )
    let refusal = ''
    try {
      text.setRangeIndentation(0, 3, -1.5)
    } catch (error) {
      refusal = error instanceof Error ? error.message : ''
    }
    expect(refusal).toBe(
      'in setRangeIndentation: Property "indentation" failed validation: Expected int, received number'
    )
  })

  test('font names and lengths take no keys Figma does not know', async () => {
    const api = createAPI()
    await api.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const text = api.createText()
    text.characters = 'Hello'
    expect(() =>
      text.setRangeFontName(0, 3, { family: 'Inter', style: 'Regular', foo: 1 } as never)
    ).toThrow('in setRangeFontName: Property "value" failed validation: Unrecognized key: "foo"')
    expect(() =>
      text.setRangeLetterSpacing(0, 3, { unit: 'PIXELS', value: 1, foo: 1 } as never)
    ).toThrow(
      'in setRangeLetterSpacing: Property "value" failed validation: Unrecognized key: "foo"'
    )
    expect(() =>
      text.setRangeFontName(0, 3, { family: 'Inter', variationSettings: 3 } as never)
    ).toThrow('Expected record, received number at .variationSettings')
    expect(() => text.setRangeLetterSpacing(0, 3, { unit: ['PIXELS'], value: 1 } as never)).toThrow(
      'Invalid option: expected one of "PIXELS"|"PERCENT" at .unit'
    )
    expect(() => text.setRangeLineHeight(0, 3, { unit: ['PIXELS'], value: 1 } as never)).toThrow(
      'Expected .unit to be one of the following: PIXELS, PERCENT, AUTO'
    )
  })
})
