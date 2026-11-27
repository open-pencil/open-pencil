import { describe, expect, test } from 'bun:test'

import { formatBytes, formatCompact, formatCountry, formatDay } from '@/app/metrics/format'
import { presetRange } from '@/app/metrics/range'

describe('metrics labels', () => {
  test('names countries, and Cloudflare codes that are not countries', () => {
    expect(formatCountry('US')).toBe('United States')
    // Tor traffic: `Intl.DisplayNames` throws on this code.
    expect(formatCountry('T1')).toBe('Tor')
    expect(formatCountry('XX')).toBe('Unknown')
    expect(formatCountry('1')).toBe('1')
  })

  test('formats a day as the UTC day it names', () => {
    expect(formatDay('2026-10-19')).toBe('Oct 19')
  })

  test('shortens axis counts past a thousand', () => {
    expect(formatCompact(950)).toBe('950')
    expect(formatCompact(1500)).toBe('1.5K')
    expect(formatCompact(10_000)).toBe('10K')
  })

  test('sizes storage in decimal units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(1500)).toBe('1.5 kB')
    expect(formatBytes(1_843_000_000)).toBe('1.8 GB')
    expect(formatBytes(2_500_000_000_000)).toBe('2.5 TB')
  })
})

describe('metrics ranges', () => {
  test('a preset ends today and never starts before the first recorded day', () => {
    expect(presetRange('7d', '2026-10-19')).toEqual({
      preset: '7d',
      start: '2026-10-13',
      end: '2026-10-19'
    })
    expect(presetRange('30d', '2026-10-19', '2026-09-22')).toMatchObject({ start: '2026-09-22' })
  })
})
