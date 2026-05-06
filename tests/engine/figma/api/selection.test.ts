import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('selection', () => {
  test('selection get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    api.currentPage.selection = [frame]
    expect(api.currentPage.selection.length).toBe(1)
    expect(api.currentPage.selection[0].id).toBe(frame.id)
  })

  test('selection empty by default', () => {
    const api = createAPI()
    expect(api.currentPage.selection).toEqual([])
  })
})
