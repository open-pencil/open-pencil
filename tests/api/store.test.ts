import { describe, expect, test } from 'bun:test'

import { createInvitationStore } from '../../packages/api/src/store.js'

describe('invitation store', () => {
  test('creates, finds, and revokes invitations', () => {
    const store = createInvitationStore()
    const invitation = store.createInvitation({
      boardId: 'board-123',
      sentToEmailHash: 'a'.repeat(64),
      role: 'editor',
      expiresAt: Date.now() + 60_000
    })

    expect(invitation.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(invitation.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(store.findInvitation(invitation.id)).toEqual(invitation)

    const revoked = store.revokeInvitation(invitation.id)

    expect(revoked?.revoked).toBe(true)
    expect(store.findInvitation(invitation.id)?.revoked).toBe(true)
    expect(store.revokeInvitation('missing-id')).toBeNull()
    expect(store.findInvitation('missing-id')).toBeNull()
  })
})
