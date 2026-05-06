import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('stubs', () => {
  test('loadFontAsync resolves', async () => {
    const api = createAPI()
    await api.loadFontAsync({ family: 'Inter', style: 'Regular' })
  })

  test('mixed is a symbol', () => {
    const api = createAPI()
    expect(typeof api.mixed).toBe('symbol')
  })
})
