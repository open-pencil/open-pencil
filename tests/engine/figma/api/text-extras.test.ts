import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

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
