import { beforeAll, describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { registerTestFont } from '#core-tests/helpers/figma-api'

beforeAll(async () => {
  await registerTestFont()
  await new FigmaAPI(new SceneGraph()).loadFontAsync({ family: 'Inter', style: 'Bold' })
})

// Shapes and messages follow `@figma/plugin-typings` and the Plugin API documentation for the
// range methods; validation messages follow those Figma reports for the other range setters.
function styledText(characters = 'Hello world') {
  const api = new FigmaAPI(new SceneGraph())
  const text = api.createText()
  text.characters = characters
  return { api, text }
}

const RED: Color = { r: 1, g: 0, b: 0, a: 1 }
const LINK = { type: 'URL' as const, value: 'https://openpencil.dev' }

function textStyle(api: FigmaAPI, id: string, fields: Record<string, unknown>) {
  const page = api.graph.getPages()[0]
  const style = api.graph.createNode('TEXT', page.id, {
    name: 'Heading',
    sharedStyleType: 'TEXT',
    internalOnly: true,
    ...fields
  })
  style.source.id = id
  return style
}

function fillStyle(api: FigmaAPI, id: string) {
  const page = api.graph.getPages()[0]
  const style = api.graph.createNode('RECTANGLE', page.id, {
    name: 'Brand/Red',
    sharedStyleType: 'FILL',
    internalOnly: true,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  style.source.id = id
  return style
}

describe('text case ranges', () => {
  test('case a range, reading the node mixed until it is cased again', () => {
    const { text } = styledText()
    text.setRangeTextCase(0, 5, 'UPPER')

    expect(text.getRangeTextCase(0, 5)).toBe('UPPER')
    expect(typeof text.getRangeTextCase(4, 7)).toBe('symbol')
    expect(typeof text.textCase).toBe('symbol')
    expect(text.getStyledTextSegments(['textCase'])).toEqual([
      { characters: 'Hello', start: 0, end: 5, textCase: 'UPPER' },
      { characters: ' world', start: 5, end: 11, textCase: 'ORIGINAL' }
    ])

    text.textCase = 'LOWER'
    expect(text.textCase).toBe('LOWER')
    expect(text.getRangeTextCase(0, 5)).toBe('LOWER')
  })

  test('reject what Figma rejects, and small caps OpenPencil cannot draw', () => {
    const { text } = styledText()
    expect(() => text.setRangeTextCase(0, 5, 'SHOUT' as 'UPPER')).toThrow(
      `in setRangeTextCase: Property "value" failed validation: Invalid enum value. Expected 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS' | 'SMALL_CAPS_FORCED', received 'SHOUT'`
    )
    expect(() => text.setRangeTextCase(0, 5, 'SMALL_CAPS' as 'UPPER')).toThrow(
      'in setRangeTextCase: OpenPencil does not support the SMALL_CAPS text case'
    )
    expect(() => text.setRangeTextCase(3, 3, 'UPPER')).toThrow(
      "in setRangeTextCase: Empty range selected. 'end' must be greater than 'start'"
    )
  })
})

describe('hyperlink ranges', () => {
  test('link a range, read null where none is, and mixed across both', () => {
    const { text } = styledText()
    text.setRangeHyperlink(6, 11, LINK)

    expect(text.getRangeHyperlink(6, 11)).toEqual(LINK)
    expect(text.getRangeHyperlink(0, 5)).toBeNull()
    expect(typeof text.getRangeHyperlink(0, 11)).toBe('symbol')
    expect(typeof text.hyperlink).toBe('symbol')

    text.setRangeHyperlink(6, 11, null)
    expect(text.getRangeHyperlink(0, 11)).toBeNull()
    expect(text.hyperlink).toBeNull()
    expect(text.getStyledTextSegments(['hyperlink'])).toHaveLength(1)
  })

  test('link the whole text from the node, to a URL or a node', () => {
    const { api, text } = styledText()
    const frame = api.createFrame()
    text.hyperlink = { type: 'NODE', value: frame.id }
    expect(text.getRangeHyperlink(0, 11)).toEqual({ type: 'NODE', value: frame.id })
    expect(text.hyperlink).toEqual({ type: 'NODE', value: frame.id })
  })

  test('reject links Figma rejects', () => {
    const { text } = styledText()
    expect(() => text.setRangeHyperlink(0, 5, 'https://x' as never)).toThrow(
      'in setRangeHyperlink: Property "value" failed validation: Expected object, received string'
    )
    expect(() => text.setRangeHyperlink(0, 5, { type: 'PAGE', value: 'x' } as never)).toThrow(
      `in setRangeHyperlink: Property "value" failed validation: Invalid enum value. Expected 'URL' | 'NODE', received 'PAGE' at .type`
    )
    expect(() => text.setRangeHyperlink(0, 5, { type: 'URL', value: 3 } as never)).toThrow(
      'in setRangeHyperlink: Property "value" failed validation: Expected string, received number at .value'
    )
  })

  // Measured in live Figma (2026-10-11).
  test('link only to web, mail, and phone addresses, and to layers Figma can frame', () => {
    const { api, text } = styledText()
    for (const value of ['https://example.com/a?b=1#c', 'http://x.co', 'mailto:a@b.co', 'tel:+1']) {
      text.setRangeHyperlink(0, 5, { type: 'URL', value })
      expect(text.getRangeHyperlink(0, 5)).toEqual({ type: 'URL', value })
    }
    for (const value of [
      'example.com',
      'ftp://x.co',
      'HTTPS://X.CO',
      'https://',
      ' https://x.co'
    ]) {
      expect(() => text.setRangeHyperlink(0, 5, { type: 'URL', value })).toThrow(
        'in setRangeHyperlink: Unsupported or invalid hyperlink url'
      )
    }
    text.setRangeHyperlink(0, 5, { type: 'URL', value: '' })
    expect(text.getRangeHyperlink(0, 5)).toBeNull()

    for (const layer of [api.createFrame(), api.createSection(), api.currentPage]) {
      text.setRangeHyperlink(0, 5, { type: 'NODE', value: layer.id })
      expect(text.getRangeHyperlink(0, 5)).toEqual({ type: 'NODE', value: layer.id })
    }
    for (const value of [api.createRectangle().id, text.id, 'missing']) {
      expect(() => text.setRangeHyperlink(0, 5, { type: 'NODE', value })).toThrow(
        'in setRangeHyperlink: Invalid hyperlink target node specified'
      )
    }
  })
})

describe('style ranges', () => {
  test('give a range a text style and its fields, and detach it when restyled', async () => {
    const { api, text } = styledText()
    textStyle(api, '1:20', { fontSize: 32, fontWeight: 700, textCase: 'UPPER' })

    await text.setRangeTextStyleIdAsync(0, 5, '1:20')
    expect(text.getRangeTextStyleId(0, 5)).toBe('1:20')
    expect(text.getRangeFontSize(0, 5)).toBe(32)
    expect(text.getRangeTextCase(0, 5)).toBe('UPPER')
    expect(text.getRangeTextStyleId(6, 11)).toBe('')
    expect(typeof text.textStyleId).toBe('symbol')

    text.setRangeFontSize(0, 2, 10)
    expect(text.getRangeTextStyleId(0, 2)).toBe('')
    expect(text.getRangeTextStyleId(2, 5)).toBe('1:20')

    text.setRangeTextStyleId(0, 5, '')
    expect(text.getRangeTextStyleId(0, 11)).toBe('')
  })

  test('give a range a fill style and its paints, and detach it when filled', async () => {
    const { api, text } = styledText()
    fillStyle(api, '1:30')

    await text.setRangeFillStyleIdAsync(0, 5, '1:30')
    expect(text.getRangeFillStyleId(0, 5)).toBe('1:30')
    expect(text.getRangeFills(0, 5)).toMatchObject([{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }])
    expect(typeof text.fillStyleId).toBe('symbol')

    text.setRangeFills(0, 5, [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }])
    expect(text.getRangeFillStyleId(0, 5)).toBe('')
  })

  test('set the node style for every character', async () => {
    const { api, text } = styledText()
    fillStyle(api, '1:30')
    await text.setRangeFillStyleIdAsync(0, 5, '1:30')
    text.fillStyleId = ''
    expect(text.fillStyleId).toBe('')
    expect(text.getRangeFillStyleId(0, 11)).toBe('')
  })

  test('take only string style IDs', () => {
    const { text } = styledText()
    expect(() => text.setRangeTextStyleId(0, 5, 7 as never)).toThrow(
      'in setRangeTextStyleId: Property "styleId" failed validation: Expected string, received number'
    )
  })
})

describe('bound variable ranges', () => {
  function sized() {
    const { api, text } = styledText()
    const collection = api.variables.createVariableCollection('Type')
    const size = api.variables.createVariable('size/lg', collection, 'FLOAT')
    size.setValueForMode(collection.defaultModeId, 28)
    const family = api.variables.createVariable('font/body', collection, 'STRING')
    family.setValueForMode(collection.defaultModeId, 'Roboto')
    return { api, text, collection, size, family }
  }

  test('bind a range, show the variable value there, and follow it when it changes', () => {
    const { text, collection, size } = sized()
    text.setRangeBoundVariable(0, 5, 'fontSize', size)

    expect(text.getRangeBoundVariable(0, 5, 'fontSize')).toEqual({
      type: 'VARIABLE_ALIAS',
      id: size.id
    })
    expect(text.getRangeBoundVariable(6, 11, 'fontSize')).toBeNull()
    expect(typeof text.getRangeBoundVariable(0, 11, 'fontSize')).toBe('symbol')
    expect(text.getRangeFontSize(0, 5)).toBe(28)
    expect(text.getStyledTextSegments(['boundVariables'], 0, 5)).toEqual([
      {
        characters: 'Hello',
        start: 0,
        end: 5,
        boundVariables: { fontSize: { type: 'VARIABLE_ALIAS', id: size.id } }
      }
    ])

    size.setValueForMode(collection.defaultModeId, 40)
    expect(text.getRangeFontSize(0, 5)).toBe(40)

    text.setRangeBoundVariable(0, 5, 'fontSize', null)
    expect(text.getRangeBoundVariable(0, 11, 'fontSize')).toBeNull()
    expect(text.getRangeFontSize(0, 5)).toBe(40)
  })

  test('keep other bindings of the characters bound apart', () => {
    const { text, size, family } = sized()
    text.setRangeBoundVariable(0, 5, 'fontSize', size)
    text.setRangeBoundVariable(3, 8, 'fontFamily', family)

    expect(text.getRangeBoundVariable(0, 5, 'fontSize')).toEqual({
      type: 'VARIABLE_ALIAS',
      id: size.id
    })
    expect(text.getRangeFontName(3, 8)).toMatchObject({ family: 'Roboto' })
    expect(text.getRangeBoundVariable(3, 8, 'fontFamily')).toEqual({
      type: 'VARIABLE_ALIAS',
      id: family.id
    })
  })

  test('bind paragraph spacing for the paragraphs of the range', () => {
    const { api, text } = styledText('One\nTwo')
    const collection = api.variables.createVariableCollection('Space')
    const gap = api.variables.createVariable('gap', collection, 'FLOAT')
    gap.setValueForMode(collection.defaultModeId, 12)
    text.setRangeBoundVariable(0, 2, 'paragraphSpacing', gap)
    expect(text.getRangeParagraphSpacing(0, 2)).toBe(12)
    expect(text.getRangeParagraphSpacing(5, 6)).toBe(0)
  })

  test('reject fields and variables Figma cannot bind', () => {
    const { text, size, family } = sized()
    expect(() => text.setRangeBoundVariable(0, 5, 'opacity' as 'fontSize', size)).toThrow(
      `in setRangeBoundVariable: Property "field" failed validation: Invalid enum value. Expected 'fontFamily' | 'fontSize'`
    )
    expect(() => text.setRangeBoundVariable(0, 5, 'fontSize', family)).toThrow(
      'in setRangeBoundVariable: Cannot bind a STRING variable to "fontSize", which takes FLOAT'
    )
    expect(() => text.setRangeBoundVariable(0, 5, 'fontSize', { ...size, id: 'missing' })).toThrow(
      'in setRangeBoundVariable: Variable not found'
    )
  })
})
