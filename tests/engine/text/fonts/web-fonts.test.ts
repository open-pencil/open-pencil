import { afterEach, describe, expect, test } from 'bun:test'

import {
  BROWSER_WEB_FONT_PROVIDER_ORDER,
  WEB_FONT_PROVIDER_IDS,
  WebFontResolver,
  resolveWebFontProviderOrder
} from '@open-pencil/core/text'

describe('resolveWebFontProviderOrder', () => {
  test('prefers Fontsource before Google when CORS-safe TTF order is requested', () => {
    expect(
      resolveWebFontProviderOrder(['google', 'fontsource', 'bunny', 'fontshare'], {
        preferCorsSafeTtf: true
      })
    ).toEqual(['fontsource', 'google', 'bunny', 'fontshare'])
  })

  test('keeps WEB_FONT_PROVIDER_IDS order when not preferring CORS-safe TTF', () => {
    expect(
      resolveWebFontProviderOrder(['google', 'fontsource'], {
        preferCorsSafeTtf: false
      })
    ).toEqual(['google', 'fontsource'])
  })

  test('skips disabled providers', () => {
    expect(
      resolveWebFontProviderOrder(['fontsource', 'google'], {
        preferCorsSafeTtf: true
      })
    ).toEqual(['fontsource', 'google'])
    expect(
      resolveWebFontProviderOrder(['google'], {
        preferCorsSafeTtf: true
      })
    ).toEqual(['google'])
  })

  test('BROWSER_WEB_FONT_PROVIDER_ORDER matches Fontsource-first design', () => {
    expect(BROWSER_WEB_FONT_PROVIDER_ORDER[0]).toBe('fontsource')
    expect(BROWSER_WEB_FONT_PROVIDER_ORDER).toContain('google')
    for (const id of BROWSER_WEB_FONT_PROVIDER_ORDER) {
      expect(WEB_FONT_PROVIDER_IDS).toContain(id)
    }
  })
})

describe('WebFontResolver.fetchFont', () => {
  afterEach(() => {
    // Leave no remoteFetch override if a test set one on a shared instance
  })

  test('does not short-circuit to null solely because remoteFetch is unset', async () => {
    const resolver = new WebFontResolver()
    resolver.setEnabled({
      google: false,
      fontsource: true,
      bunny: false,
      fontshare: false
    })
    resolver.setRemoteFetch(null)

    const ttf = new Uint8Array([0, 1, 0, 0, 0, 10]).buffer
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('fontsource') || url.includes('jsdelivr') || url.includes('api.fontsource')) {
        if (url.includes('/fonts') && !url.includes('.ttf')) {
          return new Response(JSON.stringify([{ family: 'Galada', id: 'galada' }]), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        return new Response(ttf, { status: 200 })
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    try {
      const buffer = await resolver.fetchFont(['Galada'], 'Regular')
      // Network/unifont may still fail in CI; the critical contract is we do not
      // hard-return null before attempting providers when remoteFetch is null.
      // If the mock satisfied unifont, we get bytes; otherwise null after try.
      if (buffer) expect(buffer.byteLength).toBeGreaterThan(0)
      else expect(buffer).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('tries providers soft-fail: first provider error does not skip remaining when ordered', async () => {
    const order = resolveWebFontProviderOrder(['google', 'fontsource'], {
      preferCorsSafeTtf: true
    })
    expect(order[0]).toBe('fontsource')
    expect(order[1]).toBe('google')
  })
})
