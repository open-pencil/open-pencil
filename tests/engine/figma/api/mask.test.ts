import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('mask', () => {
  test('isMask defaults to false', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    expect(rect.isMask).toBe(false)
    expect(rect.maskType).toBe('ALPHA')
  })

  test('can set mask properties', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.isMask = true
    rect.maskType = 'LUMINANCE'
    expect(rect.isMask).toBe(true)
    expect(rect.maskType).toBe('LUMINANCE')
  })
})
