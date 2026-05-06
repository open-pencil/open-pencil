import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('serialization', () => {
  test('toJSON returns clean object', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.name = 'Card'
    frame.resize(300, 200)
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    const json = frame.toJSON()
    expect(json.name).toBe('Card')
    expect(json.width).toBe(300)
    expect(json.fills).toBeDefined()
  })

  test('toJSON includes children', () => {
    const api = createAPI()
    const frame = api.createFrame()
    const rect = api.createRectangle()
    frame.appendChild(rect)
    const json = frame.toJSON() as { children?: unknown[] }
    expect(json.children).toBeDefined()
    expect(json.children?.length).toBe(1)
  })

  test('toString returns readable string', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.name = 'Card'
    expect(frame.toString()).toContain('FRAME')
    expect(frame.toString()).toContain('Card')
  })
})
