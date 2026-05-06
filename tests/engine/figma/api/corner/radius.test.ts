import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

describe('corner radius', () => {
  test('uniform corner radius', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.cornerRadius = 8
    expect(rect.cornerRadius).toBe(8)
    expect(rect.topLeftRadius).toBe(8)
    expect(rect.bottomRightRadius).toBe(8)
  })

  test('independent corners return mixed', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.topLeftRadius = 4
    rect.bottomRightRadius = 12
    expect(rect.cornerRadius).toBe(api.mixed)
  })
})
