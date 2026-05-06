import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('stroke details', () => {
  test('strokeWeight and strokeAlign', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.strokes = [
      { color: { r: 0, g: 0, b: 0, a: 1 }, weight: 2, opacity: 1, visible: true, align: 'CENTER' }
    ]
    expect(rect.strokeWeight).toBe(2)
    expect(rect.strokeAlign).toBe('CENTER')
    rect.strokeWeight = 4
    expect(rect.strokeWeight).toBe(4)
  })

  test('strokeCap and strokeJoin', () => {
    const api = createAPI()
    const line = api.createLine()
    expect(line.strokeCap).toBe('NONE')
    expect(line.strokeJoin).toBe('MITER')
    line.strokeCap = 'ROUND'
    line.strokeJoin = 'BEVEL'
    expect(line.strokeCap).toBe('ROUND')
    expect(line.strokeJoin).toBe('BEVEL')
  })

  test('strokeMiterLimit', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    expect(rect.strokeMiterLimit).toBe(4)
    rect.strokeMiterLimit = 8
    expect(rect.strokeMiterLimit).toBe(8)
  })

  test('individual stroke weights', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.strokeTopWeight = 1
    frame.strokeRightWeight = 2
    frame.strokeBottomWeight = 3
    frame.strokeLeftWeight = 4
    expect(frame.strokeTopWeight).toBe(1)
    expect(frame.strokeRightWeight).toBe(2)
    expect(frame.strokeBottomWeight).toBe(3)
    expect(frame.strokeLeftWeight).toBe(4)
  })
})
