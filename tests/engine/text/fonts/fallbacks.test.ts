import { describe, expect, test } from 'bun:test'

import {
  cjkLocalFallbackFamilies,
  fontFallbackEntry,
  fontFallbackManifest
} from '@open-pencil/core'

describe('font fallback manifest', () => {
  test('selects platform CJK local candidates', () => {
    expect(cjkLocalFallbackFamilies('Mozilla/5.0 (Macintosh)')).toContain('PingFang SC')
    expect(cjkLocalFallbackFamilies('Mozilla/5.0 (Windows NT 10.0)')).toContain(
      'Microsoft YaHei UI'
    )
    expect(cjkLocalFallbackFamilies('X11; Linux x86_64')).toContain('Noto Sans CJK SC')
  })

  test('defines remote fallback families for CJK and Arabic', () => {
    const manifest = fontFallbackManifest('X11; Linux x86_64')
    expect(manifest.cjk.remoteFamilies).toContain('Noto Sans SC')
    expect(manifest.cjk.remoteFamilies).toContain('Noto Sans TC')
    expect(manifest.arabic.remoteFamilies).toContain('Noto Naskh Arabic')
  })

  test('orders script-specific CJK local fallback candidates by platform', () => {
    expect(fontFallbackEntry('cjk-sc', 'Mozilla/5.0 (Macintosh)').localFamilies[0]).toBe(
      'PingFang SC'
    )
    expect(fontFallbackEntry('cjk-tc', 'Mozilla/5.0 (Macintosh)').localFamilies[0]).toBe(
      'PingFang TC'
    )
    expect(fontFallbackEntry('cjk-jp', 'Mozilla/5.0 (Windows NT 10.0)').localFamilies[0]).toBe(
      'Yu Gothic'
    )
    expect(fontFallbackEntry('cjk-kr', 'Mozilla/5.0 (Windows NT 10.0)').localFamilies[0]).toBe(
      'Malgun Gothic'
    )
  })

  test('returns entries by script', () => {
    expect(fontFallbackEntry('arabic').localFamilies).toContain('Geeza Pro')
    expect(fontFallbackEntry('cjk', 'Mozilla/5.0 (Macintosh)').localFamilies).toContain(
      'PingFang SC'
    )
  })
})
