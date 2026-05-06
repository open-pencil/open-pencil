import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

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

  test('fontName get/set', () => {
    const api = createAPI()
    const text = api.createText()
    text.fontName = { family: 'Roboto', style: 'Bold' }
    expect(text.fontName.family).toBe('Roboto')
    expect(text.fontWeight).toBe(700)
  })

  test('fontName italic', () => {
    const api = createAPI()
    const text = api.createText()
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

  test('textDirection', () => {
    const api = createAPI()
    const text = api.createText()
    text.textDirection = 'RTL'
    expect(text.textDirection).toBe('RTL')
  })

  test('textAutoResize', () => {
    const api = createAPI()
    const text = api.createText()
    text.textAutoResize = 'WIDTH_AND_HEIGHT'
    expect(text.textAutoResize).toBe('WIDTH_AND_HEIGHT')
  })
})
