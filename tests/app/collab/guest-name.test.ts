import { describe, expect, test } from 'bun:test'

import { generateGuestName } from '@/app/collab/guest-name'

describe('guest names', () => {
  test('pairs a color with an animal', () => {
    expect(generateGuestName(() => 0)).toBe('Amber Badger')
    expect(generateGuestName((length) => length - 1)).toBe('Violet Wombat')
  })

  test('picks from the whole word lists', () => {
    expect(generateGuestName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
  })
})
