import { describe, expect, test } from 'bun:test'

import { signInvitationToken, verifyInvitationToken } from '../../packages/api/src/token.js'
import { INVITATION_ISSUER, type InvitationPayload } from '../../packages/api/src/types.js'

const SECRET = 'test-secret'

function createPayload(overrides: Partial<InvitationPayload> = {}): InvitationPayload {
  const nowInSeconds = Math.floor(Date.now() / 1000)
  return {
    iss: INVITATION_ISSUER,
    sub: crypto.randomUUID(),
    board_id: 'board-123',
    role: 'editor',
    email_hash: 'a'.repeat(64),
    iat: nowInSeconds,
    exp: nowInSeconds + 60,
    jti: crypto.randomUUID(),
    ...overrides
  }
}

describe('invitation token', () => {
  test('signs and verifies with the same secret', async () => {
    const payload = createPayload()
    const token = await signInvitationToken(payload, SECRET)
    const result = await verifyInvitationToken(token, SECRET)

    expect(result.valid).toBe(true)
    if (!result.valid) throw new Error('expected token to be valid')
    expect(result.payload).toEqual(payload)
  })

  test('rejects when the secret does not match', async () => {
    const token = await signInvitationToken(createPayload(), SECRET)
    const result = await verifyInvitationToken(token, 'wrong-secret')

    expect(result).toEqual({
      valid: false,
      reason: 'invalid_signature'
    })
  })

  test('rejects expired tokens', async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000)
    const token = await signInvitationToken(
      createPayload({
        iat: nowInSeconds - 120,
        exp: nowInSeconds - 60
      }),
      SECRET
    )
    const result = await verifyInvitationToken(token, SECRET)

    expect(result).toEqual({
      valid: false,
      reason: 'expired'
    })
  })
})
