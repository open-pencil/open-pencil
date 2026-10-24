import { describe, expect, test } from 'bun:test'

import { signInMethod } from '#cloud/server/auth/activity'
import { describeUserAgent } from '#cloud/server/auth/user-agent'

describe('sign-in activity', () => {
  test('names how each Better Auth endpoint signed someone in', () => {
    expect(signInMethod({ path: '/sign-in/email' })).toBe('password')
    expect(signInMethod({ path: '/callback/:id', params: { id: 'google' } })).toBe('google')
    expect(signInMethod({ path: '/callback/:id', params: { id: 'apple' } })).toBe('apple')
    expect(signInMethod({ path: '/callback/:id', params: { id: 'github' } })).toBe('other')
    expect(signInMethod({ path: '/passkey/verify-authentication' })).toBe('passkey')
    expect(signInMethod({ path: '/two-factor/verify-totp' })).toBe('two-step')
    expect(signInMethod({ path: '/verify-email' })).toBe('email-link')
    expect(signInMethod({ path: '/device/token' })).toBe('desktop')
  })

  test('ignores endpoints that only refresh or change a session', () => {
    expect(signInMethod({ path: '/get-session' })).toBeNull()
    expect(signInMethod({ path: '/update-user' })).toBeNull()
    expect(signInMethod({})).toBeNull()
  })

  test('reads a browser and system from a user agent, and nothing from none', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'
      )
    ).toEqual({ browser: 'Microsoft Edge 141', system: 'Windows' })
    expect(describeUserAgent(null)).toEqual({ browser: null, system: null })
  })
})
