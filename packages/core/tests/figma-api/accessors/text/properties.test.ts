import { beforeAll, describe, expect, test } from 'bun:test'

import { createAPI, registerTestFont } from '#core-tests/helpers/figma-api'

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
