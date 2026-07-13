import { describe, expect, test } from 'bun:test'

import {
  BROWSER_WEB_FONT_PROVIDER_ORDER,
  WEB_FONT_PROVIDER_IDS,
  WebFontResolver,
  normalizedCoverageText,
  resolveWebFontProviderOrder,
  webFontSubsetsForText
} from '@open-pencil/core/text'

describe('web font coverage requests', () => {
  test('normalizes coverage without splitting supplementary code points', () => {
    expect(normalizedCoverageText('界A界𠀀A')).toBe(normalizedCoverageText('A界𠀀'))
    expect(Array.from(normalizedCoverageText('𠀀'))).toEqual(['𠀀'])
  })

  test('requests script-specific subsets instead of Latin only', () => {
    expect(webFontSubsetsForText('مرحبا')).toContain('arabic')
    expect(webFontSubsetsForText('한글')).toContain('korean')
    expect(webFontSubsetsForText('かな')).toContain('japanese')
    expect(webFontSubsetsForText('你好')).toEqual(
      expect.arrayContaining(['chinese-simplified', 'chinese-traditional', 'japanese'])
    )
  })
})

describe('resolveWebFontProviderOrder', () => {
  test('prefers Fontsource before Google when CORS-safe TTF order is requested', () => {
    expect(
      resolveWebFontProviderOrder(['google', 'fontsource', 'bunny', 'fontshare'], {
        preferCorsSafeTtf: true
      })
    ).toEqual(['fontsource', 'google', 'bunny', 'fontshare'])
  })

  test('keeps catalog order when not preferring CORS-safe TTF', () => {
    expect(
      resolveWebFontProviderOrder(['google', 'fontsource'], { preferCorsSafeTtf: false })
    ).toEqual(['google', 'fontsource'])
  })

  test('skips disabled providers in both orders', () => {
    expect(resolveWebFontProviderOrder(['google'], { preferCorsSafeTtf: true })).toEqual(['google'])
    expect(resolveWebFontProviderOrder([], { preferCorsSafeTtf: true })).toEqual([])
  })

  test('BROWSER_WEB_FONT_PROVIDER_ORDER is Fontsource-first and covers every provider', () => {
    expect(BROWSER_WEB_FONT_PROVIDER_ORDER[0]).toBe('fontsource')
    expect([...BROWSER_WEB_FONT_PROVIDER_ORDER].sort()).toEqual([...WEB_FONT_PROVIDER_IDS].sort())
  })
})

describe('WebFontResolver.fetchFont without a proxy', () => {
  test('still attempts providers when remoteFetch is unset', async () => {
    const resolver = new WebFontResolver()
    resolver.setEnabled({ google: false, fontsource: true, bunny: false, fontshare: false })
    resolver.setRemoteFetch(null)

    // The regression this guards: fetchFont used to hard-return before touching any
    // provider whenever no Tauri proxy was installed, which disabled online fonts on web.
    const originalFetch = globalThis.fetch
    let attempted = false
    // Serve an empty but well-formed catalog: the provider initializes (no retry storm)
    // and resolves no faces, so the assertion is about reaching the network at all.
    globalThis.fetch = (async () => {
      attempted = true
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    try {
      await expect(resolver.fetchFont(['Galada'], 'Regular')).resolves.toEqual([])
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(attempted).toBe(true)
  })

  test('returns nothing when every provider is disabled', async () => {
    const resolver = new WebFontResolver()
    resolver.setEnabled({ google: false, fontsource: false, bunny: false, fontshare: false })
    resolver.setRemoteFetch(null)

    await expect(resolver.fetchFont(['Galada'], 'Regular')).resolves.toEqual([])
  })
})
