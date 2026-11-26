import { describe, expect, test } from 'bun:test'

import { fill } from '#docs-config/theme/landing/content/messages/fill'
import { formatSize } from '#docs-config/theme/landing/download/format'
import { latestStable } from '#docs-config/theme/landing/download/releases'
import { platformOf } from '#docs-config/theme/landing/download/visitor'

const AGENTS = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
}

describe('the visitor platform', () => {
  test('desktop browsers name their system', () => {
    expect(platformOf(AGENTS.mac, 0)).toBe('mac')
    expect(platformOf(AGENTS.windows, 0)).toBe('windows')
    expect(platformOf(AGENTS.linux, 0)).toBe('linux')
  })

  test('phones and tablets get no desktop installer', () => {
    expect(platformOf(AGENTS.android, 5)).toBeNull()
    expect(platformOf(AGENTS.iphone, 5)).toBeNull()
    // An iPad asks for desktop sites with a Mac's user agent, but no Mac takes touches.
    expect(platformOf(AGENTS.mac, 5)).toBeNull()
  })
})

describe('download copy', () => {
  test('fill puts values in their placeholders and leaves unknown ones', () => {
    expect(fill('Download for {platform}', { platform: 'macOS' })).toBe('Download for macOS')
    expect(fill('{count} commands, {missing}', { count: 24 })).toBe('24 commands, {missing}')
  })

  test('sizes are megabytes in the visitor language', () => {
    expect(formatSize(8_450_000, 'en')).toBe('8.5 MB')
    expect(formatSize(98_400_000, 'en')).toBe('98 MB')
    expect(formatSize(8_450_000, 'de')).toBe('8,5 MB')
  })
})

describe('the stable release a build shows', () => {
  const release = (version: string, published: string, prerelease = false) => ({
    tag_name: `v${version}`,
    published_at: published,
    prerelease
  })

  test('pick the latest stable release by when it was published, not listed', () => {
    const stable = latestStable([
      release('0.15.0', '2026-09-01T00:00:00Z'),
      release('0.15.1', '2026-09-18T00:00:00Z')
    ])
    expect(stable?.tag_name).toBe('v0.15.1')
  })

  test('never pick a beta or the nightly, though they are newer', () => {
    const stable = latestStable([
      release('0.17.0-beta.5', '2026-11-15T00:00:00Z', true),
      { tag_name: 'nightly', published_at: '2026-11-16T03:30:00Z', prerelease: true },
      release('0.16.2', '2026-11-01T00:00:00Z')
    ])
    expect(stable?.tag_name).toBe('v0.16.2')
  })

  test('without a stable release there is none to pick', () => {
    expect(latestStable([release('0.1.0-beta.1', '2026-01-01T00:00:00Z', true)])).toBeNull()
  })
})
