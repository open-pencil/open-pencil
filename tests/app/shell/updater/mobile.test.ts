import { describe, expect, test } from 'bun:test'

import { isNewerVersion } from '@/app/shell/updater/mobile'

describe('phone update versions', () => {
  test('a higher build number is newer, compared as numbers', () => {
    expect(isNewerVersion('0.17.10', '0.17.9')).toBe(true)
    expect(isNewerVersion('0.17.9', '0.17.10')).toBe(false)
    expect(isNewerVersion('0.18.0', '0.17.99')).toBe(true)
  })

  test('the same version or an unreadable one is not an update', () => {
    expect(isNewerVersion('0.17.5', '0.17.5')).toBe(false)
    expect(isNewerVersion('beta', '0.17.5')).toBe(false)
  })
})
