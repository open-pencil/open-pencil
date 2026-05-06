import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('expanded', () => {
  test('defaults to true', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect(frame.expanded).toBe(true)
  })

  test('can collapse', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.expanded = false
    expect(frame.expanded).toBe(false)
  })
})
