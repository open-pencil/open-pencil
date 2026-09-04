import { describe, expect, test } from 'bun:test'

import { parseOAuthCallback, withoutOAuthCallback } from '#admin/auth/callback'

describe('Cloud OAuth callback state', () => {
  test('maps known callback errors without exposing provider descriptions', () => {
    expect(parseOAuthCallback({ error: 'access_denied' })).toEqual({ kind: 'cancelled' })
    expect(parseOAuthCallback({ error_code: 'enrollment_approval_required' })).toEqual({
      kind: 'approval-required'
    })
    expect(
      parseOAuthCallback({ error: 'unknown', error_description: 'secret provider detail' })
    ).toEqual({
      kind: 'provider-error'
    })
  })

  test('removes only OAuth error fields after capture', () => {
    expect(withoutOAuthCallback({ error: 'access_denied', redirect: '/admin' })).toEqual({
      redirect: '/admin'
    })
  })
})
