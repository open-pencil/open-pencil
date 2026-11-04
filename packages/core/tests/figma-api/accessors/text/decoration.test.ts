import { beforeAll, describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'
beforeAll(async () => {
  await registerTestFont('Inter')
})

// Measured with the same scripts in Figma's plugin API (Figma desktop 126).

async function text(characters = 'Hello world') {
  const figma = createAPI()
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
  const node = figma.createText()
  node.characters = characters
  return { figma, node }
}

const DECORATION_FIELDS = [
  'textDecorationStyle',
  'textDecorationOffset',
  'textDecorationThickness',
  'textDecorationColor',
  'textDecorationSkipInk'
] as const

describe('a text’s underline style', () => {
  test('reads null while the text has no underline, and Figma’s defaults once it does', async () => {
    const { node } = await text()
    expect(DECORATION_FIELDS.map((field) => node[field])).toEqual([null, null, null, null, null])
    node.textDecoration = 'STRIKETHROUGH'
    expect(DECORATION_FIELDS.map((field) => node[field])).toEqual([null, null, null, null, null])
    node.textDecoration = 'UNDERLINE'
    expect(DECORATION_FIELDS.map((field) => node[field])).toEqual([
      'SOLID',
      { unit: 'AUTO' },
      { unit: 'AUTO' },
      { value: 'AUTO' },
      true
    ])
  })

  test('sets every character’s', async () => {
    const { node } = await text()
    node.textDecoration = 'UNDERLINE'
    node.textDecorationStyle = 'WAVY'
    node.textDecorationOffset = { unit: 'PIXELS', value: 3 }
    node.textDecorationThickness = { unit: 'PIXELS', value: 2 }
    node.textDecorationColor = { value: { type: 'SOLID', color: { r: 1, g: 0, b: 0 } } }
    node.textDecorationSkipInk = false
    expect(node.textDecorationStyle).toBe('WAVY')
    expect(node.getRangeTextDecorationStyle(6, 11)).toBe('WAVY')
    expect(node.textDecorationOffset).toEqual({ unit: 'PIXELS', value: 3 })
    expect(node.textDecorationThickness).toEqual({ unit: 'PIXELS', value: 2 })
    expect(node.textDecorationColor).toMatchObject({
      value: { type: 'SOLID', color: { r: 1, g: 0, b: 0 } }
    })
    expect(node.textDecorationSkipInk).toBe(false)
  })

  test('is read from the underlined characters alone', async () => {
    const { node } = await text()
    node.textDecoration = 'UNDERLINE'
    node.setRangeTextDecorationStyle(0, 5, 'SOLID')
    node.setRangeTextDecorationStyle(5, 11, 'WAVY')
    expect(typeof node.textDecorationStyle).toBe('symbol')
    node.setRangeTextDecoration(0, 5, 'NONE')
    expect(node.textDecorationStyle).toBe('WAVY')
    expect(node.getRangeTextDecorationStyle(0, 11)).toBe('WAVY')
    expect(node.getRangeTextDecorationStyle(0, 5)).toBeNull()
  })

  test('is refused on text with no underline, apart from skip ink, which waits for one', async () => {
    const { node } = await text()
    const refusal = (field: string, name: string) =>
      `in set_${field}: Cannot set text decoration ${name} on a non-underlined text range`
    expect(() => (node.textDecorationStyle = 'WAVY')).toThrow(
      refusal('textDecorationStyle', 'style')
    )
    expect(() => (node.textDecorationOffset = { unit: 'PIXELS', value: 2 })).toThrow(
      refusal('textDecorationOffset', 'offset')
    )
    expect(() => (node.textDecorationThickness = { unit: 'PIXELS', value: 2 })).toThrow(
      refusal('textDecorationThickness', 'thickness')
    )
    expect(() => (node.textDecorationColor = { value: 'AUTO' })).toThrow(
      refusal('textDecorationColor', 'color')
    )
    node.textDecorationSkipInk = false
    expect(node.textDecorationSkipInk).toBeNull()
    node.textDecoration = 'UNDERLINE'
    expect(node.textDecorationSkipInk).toBe(false)
  })

  test('checks the value, under the property’s name, before the underline', async () => {
    const { node } = await text()
    expect(() => (node.textDecorationSkipInk = 'no' as never)).toThrow(
      'in set_textDecorationSkipInk: Property "textDecorationSkipInk" failed validation: Expected boolean, received string'
    )
    expect(() => (node.textDecorationStyle = 'DASHED' as never)).toThrow(
      'in set_textDecorationStyle: Property "textDecorationStyle" failed validation:'
    )
    expect(() => (node.textDecorationOffset = 3 as never)).toThrow(
      'in set_textDecorationOffset: Property "textDecorationOffset" failed validation: Expected object, received number'
    )
  })
})

describe('a text’s leading trim', () => {
  test('reads and sets the trim', async () => {
    const { figma, node } = await text()
    expect(node.leadingTrim).toBe('NONE')
    node.leadingTrim = 'CAP_HEIGHT'
    expect(node.leadingTrim).toBe('CAP_HEIGHT')
    expect(figma.graph.getNode(node.id)?.leadingTrim).toBe('CAP_HEIGHT')
    expect(() => (node.leadingTrim = 'X' as never)).toThrow(
      'in set_leadingTrim: Property "leadingTrim" failed validation: Invalid option: expected one of "CAP_HEIGHT"|"NONE"'
    )
  })
})

describe('a text’s OpenType features', () => {
  test('read the features its characters set, and cannot be assigned', async () => {
    const { figma, node } = await text()
    expect<unknown>(node.openTypeFeatures).toEqual({})
    expect(Object.isFrozen(node.openTypeFeatures)).toBe(true)
    figma.graph.updateNode(node.id, { fontFeatures: [{ tag: 'CALT', enabled: false }] })
    expect<unknown>(node.openTypeFeatures).toEqual({ CALT: false })
    ;(node as { openTypeFeatures: unknown }).openTypeFeatures = { LIGA: false }
    expect<unknown>(node.openTypeFeatures).toEqual({ CALT: false })
  })
})
