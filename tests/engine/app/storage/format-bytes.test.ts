import { describe, expect, test } from 'bun:test'

import { formatStorageBytes } from '@/app/storage/format-bytes'

describe('formatStorageBytes', () => {
  test('formats common sizes', () => {
    expect(formatStorageBytes(0)).toBe('0 B')
    expect(formatStorageBytes(512)).toBe('512 B')
    expect(formatStorageBytes(2048)).toBe('2 KB')
    expect(formatStorageBytes(1024 * 1024 * 3)).toBe('3.0 MB')
  })
})
