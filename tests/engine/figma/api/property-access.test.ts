import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('property access', () => {
  test('name get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.name = 'Card'
    expect(frame.name).toBe('Card')
  })

  test('position get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.x = 50
    frame.y = 100
    expect(frame.x).toBe(50)
    expect(frame.y).toBe(100)
  })

  test('resize', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.resize(300, 200)
    expect(frame.width).toBe(300)
    expect(frame.height).toBe(200)
  })

  test('fills get/set', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    expect(rect.fills.length).toBe(1)
    expect(rect.fills[0].color.r).toBe(1)
  })

  test('opacity get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.opacity = 0.5
    expect(frame.opacity).toBe(0.5)
  })

  test('visible get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.visible = false
    expect(frame.visible).toBe(false)
  })

  test('locked get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.locked = true
    expect(frame.locked).toBe(true)
  })

  test('rotation get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.rotation = 45
    expect(frame.rotation).toBe(45)
  })

  test('clipsContent get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.clipsContent = true
    expect(frame.clipsContent).toBe(true)
  })
})
