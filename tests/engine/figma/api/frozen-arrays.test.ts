import { describe, expect, test } from 'bun:test'

import { type Fill } from '@open-pencil/core'

import { createAPI } from './helpers'

describe('frozen arrays', () => {
  test('fills returns frozen clone', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    const fills = rect.fills
    expect(Object.isFrozen(fills)).toBe(true)
    expect(() => {
      ;(fills as Fill[]).push({} as Fill)
    }).toThrow()
  })

  test('mutating returned fills does not affect node', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    const fills = rect.fills as Fill[]
    try {
      fills[0].color.r = 0
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError)
    }
    expect(rect.fills[0].color.r).toBe(1)
  })
})
