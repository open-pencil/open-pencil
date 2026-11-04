import { describe, expect, test } from 'bun:test'

import { cloudAuthFailure } from '#cloud/client'

describe('sign-in failures', () => {
  test('tell passkey refusals from server failures', () => {
    expect(cloudAuthFailure({ code: 'ERROR_CEREMONY_ABORTED', status: 400 }).failure).toBe(
      'passkey-cancelled'
    )
    expect(
      cloudAuthFailure({ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', status: 400 }).failure
    ).toBe('passkey-exists')
    // A browser that won't make passkeys for the address, such as Safari on some local hosts.
    expect(cloudAuthFailure({ code: 'ERROR_INVALID_DOMAIN', status: 400 }).failure).toBe(
      'passkey-unavailable'
    )
    expect(cloudAuthFailure({ code: 'SOMETHING_ELSE', status: 500 }).failure).toBe('unavailable')
    expect(cloudAuthFailure({ code: 'SESSION_NOT_FRESH', status: 403 }).failure).toBe(
      'session-not-fresh'
    )
    expect(cloudAuthFailure({ status: 429 }).failure).toBe('rate-limited')
  })
})
