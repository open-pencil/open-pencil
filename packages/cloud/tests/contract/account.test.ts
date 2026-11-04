import { describe, expect, test } from 'bun:test'

import { cloudPasskeysResponseSchema } from '#cloud/contract'
import * as v from 'valibot'

describe('account contract', () => {
  test('reads a passkey the browser created without a name', () => {
    const passkey = { id: 'passkey-1', name: null, createdAt: '2026-10-15T12:54:14.633Z' }
    expect(v.parse(cloudPasskeysResponseSchema, { passkeys: [passkey] })).toEqual({
      passkeys: [passkey]
    })
  })
})
