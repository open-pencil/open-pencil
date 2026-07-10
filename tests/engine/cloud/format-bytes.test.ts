import { describe, expect, test } from 'bun:test'

import { formatCloudBytes } from '@/app/cloud/format-bytes'

describe('formatCloudBytes', () => {
  test('formats common sizes', () => {
    expect(formatCloudBytes(0)).toBe('0 B')
    expect(formatCloudBytes(512)).toBe('512 B')
    expect(formatCloudBytes(2048)).toBe('2 KB')
    expect(formatCloudBytes(1024 * 1024 * 3)).toBe('3.0 MB')
  })
})
