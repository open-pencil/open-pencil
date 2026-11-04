import { describe, expect, test } from 'bun:test'

import { resolveAppTheme } from '@/app/settings/theme'

describe('stored theme', () => {
  test('start dark unless light was chosen, whatever the system prefers', () => {
    expect(resolveAppTheme(null, false)).toBe('dark')
    expect(resolveAppTheme('dark', false)).toBe('dark')
    expect(resolveAppTheme('light', true)).toBe('light')
    expect(resolveAppTheme('sepia', false)).toBe('dark')
  })

  test('follow the system when set to auto', () => {
    expect(resolveAppTheme('auto', true)).toBe('dark')
    expect(resolveAppTheme('auto', false)).toBe('light')
  })
})
