import { describe, expect, test } from 'bun:test'

import { signInEndpoints, signInMethod } from '#cloud/server/auth/activity'
import { describeUserAgent } from '#cloud/server/auth/user-agent'
import { passkey } from '@better-auth/passkey'
import { deviceAuthorization, twoFactor } from 'better-auth/plugins'

// The sign-in endpoints of the plugins the server mounts, from the plugins' own paths.
const methods = signInEndpoints({
  twoStep: twoFactor().endpoints,
  passkeys: passkey({
    rpID: 'cloud.example.com',
    rpName: 'Cloud',
    origin: 'https://cloud.example.com'
  }).endpoints,
  devices: deviceAuthorization().endpoints
})

describe('sign-in activity', () => {
  test('names how each Better Auth endpoint signed someone in', () => {
    expect(signInMethod({ path: '/sign-in/email' }, methods)).toBe('password')
    expect(signInMethod({ path: '/callback/:id', params: { id: 'google' } }, methods)).toBe(
      'google'
    )
    expect(signInMethod({ path: '/callback/:id', params: { id: 'apple' } }, methods)).toBe('apple')
    expect(signInMethod({ path: '/callback/:id', params: { id: 'github' } }, methods)).toBe('other')
    expect(signInMethod({ path: '/passkey/verify-authentication' }, methods)).toBe('passkey')
    expect(signInMethod({ path: '/two-factor/verify-totp' }, methods)).toBe('two-step')
    expect(signInMethod({ path: '/verify-email' }, methods)).toBe('email-link')
    expect(signInMethod({ path: '/device/token' }, methods)).toBe('desktop')
  })

  test('ignores endpoints that only refresh or change a session', () => {
    expect(signInMethod({ path: '/get-session' }, methods)).toBeNull()
    expect(signInMethod({ path: '/update-user' }, methods)).toBeNull()
    expect(signInMethod({}, methods)).toBeNull()
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
