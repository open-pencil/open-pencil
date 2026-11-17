import { describe, expect, test } from 'bun:test'

import { signInMethodAllowed, type SignInMethodBlockStore } from '#cloud/server/auth/methods'

/** Better Auth's keyed values, holding one administrator's block on Grace's lost Google account. */
function blockedStore(): SignInMethodBlockStore {
  const values = new Map([['sign-in-method-block:grace:google', 'google-lost']])
  return {
    async findVerificationValue(identifier) {
      const value = values.get(identifier)
      return value === undefined ? null : { value }
    },
    async deleteVerificationByIdentifier(identifier) {
      values.delete(identifier)
    }
  }
}

const lost = { userId: 'grace', providerId: 'google', accountId: 'google-lost' }
const nobodyLinking = async () => null

describe('sign-in method blocks', () => {
  test('keep an identity an administrator removed from linking itself back', async () => {
    const store = blockedStore()
    // A sign-in with the lost Google account, which would link by Grace's email.
    expect(await signInMethodAllowed(store, lost, nobodyLinking)).toBe(false)
    // Someone else linking it to Grace's account is no better.
    expect(await signInMethodAllowed(store, lost, async () => 'ada')).toBe(false)
  })

  test('let other identities link as before', async () => {
    const store = blockedStore()
    expect(
      await signInMethodAllowed(store, { ...lost, accountId: 'google-new' }, nobodyLinking)
    ).toBe(true)
    expect(await signInMethodAllowed(store, { ...lost, providerId: 'apple' }, nobodyLinking)).toBe(
      true
    )
    expect(await signInMethodAllowed(store, { ...lost, userId: 'ada' }, nobodyLinking)).toBe(true)
  })

  test('let the owner link it again from their own security page', async () => {
    expect(await signInMethodAllowed(blockedStore(), lost, async () => 'grace')).toBe(true)
  })
})
