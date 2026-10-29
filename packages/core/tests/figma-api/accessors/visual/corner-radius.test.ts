import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'

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
    // `api.mixed` widens to `symbol`, so the matcher is typed to accept either side.
    expect<number | symbol>(rect.cornerRadius).toBe(api.mixed)
  })

  // Figma desktop, 2026-10-26: `mixed` after the first corner, then 5 once all four are 5.
  test('corners set one by one read as one radius once they agree, as in Figma', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.topLeftRadius = 5
    expect<number | symbol>(rect.cornerRadius).toBe(api.mixed)
    rect.topRightRadius = 5
    rect.bottomLeftRadius = 5
    rect.bottomRightRadius = 5
    expect<number | symbol>(rect.cornerRadius).toBe(5)
  })
})
