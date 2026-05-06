import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

describe('min/max dimensions', () => {
  test('defaults to null', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect(frame.minWidth).toBeNull()
    expect(frame.maxWidth).toBeNull()
    expect(frame.minHeight).toBeNull()
    expect(frame.maxHeight).toBeNull()
  })

  test('can set and read', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.minWidth = 50
    frame.maxWidth = 400
    frame.minHeight = 30
    frame.maxHeight = 600
    expect(frame.minWidth).toBe(50)
    expect(frame.maxWidth).toBe(400)
    expect(frame.minHeight).toBe(30)
    expect(frame.maxHeight).toBe(600)
  })

  test('can reset to null', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.minWidth = 50
    frame.minWidth = null
    expect(frame.minWidth).toBeNull()
  })
})
