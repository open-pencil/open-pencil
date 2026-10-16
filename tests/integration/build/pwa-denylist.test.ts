import { describe, expect, test } from 'bun:test'

import { pwaNavigateFallbackDenylist } from '#vite-config/pwa'

function denied(denylist: RegExp[], path: string): boolean {
  return denylist.some((pattern) => pattern.test(path))
}

describe('service worker navigation fallback', () => {
  test('OAuth callbacks reach the server', () => {
    const denylist = pwaNavigateFallbackDenylist(undefined)
    for (const path of ['/oauth/callback', '/oauth2/callback?code=abc', '/oauth2/sign_in']) {
      expect(denied(denylist, path)).toBe(true)
    }
  })

  test('editor routes keep the cached shell', () => {
    const denylist = pwaNavigateFallbackDenylist(undefined)
    for (const path of ['/', '/file/abc', '/settings', '/oauth', '/oauth2', '/app/oauth2/x']) {
      expect(denied(denylist, path)).toBe(false)
    }
  })

  test('a deployment adds its own sign-in proxy paths', () => {
    const denylist = pwaNavigateFallbackDenylist(' /.auth/ ,/sso ,')
    expect(denied(denylist, '/.auth/login/aad/callback')).toBe(true)
    expect(denied(denylist, '/sso/return')).toBe(true)
    expect(denied(denylist, '/oauth2/callback')).toBe(true)
    // The dot is literal, not "any character".
    expect(denied(denylist, '/xauth/login')).toBe(false)
  })

  test('an entry without a trailing slash also covers the path itself', () => {
    const denylist = pwaNavigateFallbackDenylist('/sso')
    for (const path of ['/sso', '/sso?next=/file/abc', '/sso/return']) {
      expect(denied(denylist, path)).toBe(true)
    }
    expect(denied(denylist, '/ssox')).toBe(false)
  })

  test('an entry that is not a path is rejected', () => {
    expect(() => pwaNavigateFallbackDenylist('auth/')).toThrow('must start with "/"')
  })
})
