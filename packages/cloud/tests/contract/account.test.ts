import { describe, expect, test } from 'bun:test'

import {
  cloudAuthenticationMethodsResponseSchema,
  cloudPasskeysResponseSchema,
  cloudSignInsResponseSchema
} from '#cloud/contract'
import * as v from 'valibot'

describe('account contract', () => {
  test('reads a passkey the browser created without a name', () => {
    const passkey = { id: 'passkey-1', name: null, createdAt: '2026-10-15T12:54:14.633Z' }
    expect(v.parse(cloudPasskeysResponseSchema, { passkeys: [passkey] })).toEqual({
      passkeys: [passkey]
    })
  })

  // A newer server may offer a provider this editor has no button or words for.
  test('leaves out sign-in methods from a provider this editor does not know', () => {
    const method = (id: string, provider: string) => ({
      id,
      provider,
      createdAt: '2026-11-18T12:00:00.000Z',
      canUnlink: true
    })
    const response = v.parse(cloudAuthenticationMethodsResponseSchema, {
      methods: [method('m1', 'credential'), method('m2', 'gitlab'), method('m3', 'github')],
      availableSocialProviders: ['gitlab', 'google']
    })
    expect(response.methods.map((entry) => entry.provider)).toEqual(['credential', 'github'])
    expect(response.availableSocialProviders).toEqual(['google'])
    // Anything else malformed still fails.
    expect(() =>
      v.parse(cloudAuthenticationMethodsResponseSchema, {
        methods: [{ ...method('m1', 'google'), canUnlink: 'yes' }],
        availableSocialProviders: []
      })
    ).toThrow()
  })

  test('reads a sign-in method this editor does not know as other', () => {
    const signIn = {
      id: 's1',
      method: 'gitlab',
      ipAddress: null,
      browser: null,
      system: null,
      createdAt: '2026-11-18T12:00:00.000Z'
    }
    expect(v.parse(cloudSignInsResponseSchema, { signIns: [signIn] }).signIns[0]?.method).toBe(
      'other'
    )
    // A value that is not a method name still fails.
    for (const method of [42, undefined]) {
      expect(() =>
        v.parse(cloudSignInsResponseSchema, { signIns: [{ ...signIn, method }] })
      ).toThrow()
    }
  })
})
