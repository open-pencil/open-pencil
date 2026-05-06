import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

describe('absolute position', () => {
  test('absoluteBoundingBox accounts for nesting', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.x = 100
    parent.y = 200
    const child = api.createRectangle()
    parent.appendChild(child)
    child.x = 10
    child.y = 20
    child.resize(50, 30)
    const bounds = child.absoluteBoundingBox
    expect(bounds.x).toBe(110)
    expect(bounds.y).toBe(220)
    expect(bounds.width).toBe(50)
    expect(bounds.height).toBe(30)
  })
})
