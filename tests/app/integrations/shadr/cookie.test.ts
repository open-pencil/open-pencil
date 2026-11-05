import { describe, expect, test } from 'bun:test'

import { getCookie, setCookie } from '@/app/integrations/shadr/store/cookie'

describe('Cookie Storage', () => {
  test('saves and retrieves cookie value', () => {
    // Mock document.cookie in test runtime if needed
    if (typeof document === 'undefined') {
      const store: Record<string, string> = {}
      globalThis.document = {
        get cookie() {
          return Object.entries(store)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ')
        },
        set cookie(val: string) {
          const [pair] = val.split(';')
          const [k, v] = pair.split('=')
          store[k.trim()] = v.trim()
        }
      } as unknown as Document
    }

    setCookie('shadr_token', 'test_secret_token_123')
    expect(getCookie('shadr_token')).toBe('test_secret_token_123')
  })
})
