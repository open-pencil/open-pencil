import { describe, expect, test } from 'bun:test'

import {
  allowSignInMethod,
  blockSignInMethod,
  signInMethodAllowed,
  signInMethodHooks,
  type SignInMethodBlockStore
} from '#cloud/server/auth/methods'

/** Better Auth's keyed values, kept in memory. */
function memoryStore(): SignInMethodBlockStore & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    async createVerificationValue(data) {
      values.set(data.identifier, data.value)
    },
    async findVerificationValue(identifier) {
      const value = values.get(identifier)
      return value === undefined ? null : { value }
    },
    async deleteVerificationByIdentifier(identifier) {
      values.delete(identifier)
    }
  }
}

describe('sign-in method blocks', () => {
  test('keep an identity an administrator removed from linking itself back', async () => {
    const store = memoryStore()
    const lost = { userId: 'grace', providerId: 'google', accountId: 'google-lost' }
    expect(await signInMethodAllowed(store, lost)).toBe(true)

    await blockSignInMethod(store, 'grace', { provider: 'google', accountId: 'google-lost' })
    expect(await signInMethodAllowed(store, lost)).toBe(false)
    // Another Google account of hers, and the same one on someone else's account, still link.
    expect(await signInMethodAllowed(store, { ...lost, accountId: 'google-new' })).toBe(true)
    expect(await signInMethodAllowed(store, { ...lost, userId: 'ada' })).toBe(true)

    // Adding Google again from her security page lifts it.
    await allowSignInMethod(store, 'grace', 'google')
    expect(await signInMethodAllowed(store, lost)).toBe(true)
  })

  test('leave a removed password nothing to block', async () => {
    const store = memoryStore()
    await blockSignInMethod(store, 'grace', { provider: 'credential', accountId: 'grace' })
    expect(store.values.size).toBe(0)
  })

  // Better Auth hands its hook the store with the endpoint that creates the account.
  test('let an account be made where Better Auth gives no store', async () => {
    const before = signInMethodHooks.account?.create?.before
    const now = new Date()
    expect(
      await before?.(
        {
          id: 'new',
          userId: 'grace',
          providerId: 'google',
          accountId: 'google-lost',
          createdAt: now,
          updatedAt: now
        },
        null
      )
    ).toBeUndefined()
  })
})
