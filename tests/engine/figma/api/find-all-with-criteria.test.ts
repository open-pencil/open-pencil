import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('findAllWithCriteria', () => {
  test('filters by type', () => {
    const api = createAPI()
    api.createFrame()
    api.createRectangle()
    api.createText()
    api.createRectangle()
    const rects = api.currentPage.findAllWithCriteria({ types: ['RECTANGLE'] })
    expect(rects.length).toBe(2)
    expect(rects.every((n) => n.type === 'RECTANGLE')).toBe(true)
  })

  test('filters by multiple types', () => {
    const api = createAPI()
    api.createFrame()
    api.createRectangle()
    api.createText()
    const result = api.currentPage.findAllWithCriteria({ types: ['FRAME', 'TEXT'] })
    expect(result.length).toBe(2)
  })
})
