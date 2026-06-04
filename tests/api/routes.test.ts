import { describe, expect, test } from 'bun:test'

import { createApiApp } from '../../packages/api/src/server.js'
import { createInvitationStore } from '../../packages/api/src/store.js'

const SECRET = 'test-secret'

describe('invite routes', () => {
  test('creates and verifies an invitation', async () => {
    const store = createInvitationStore()
    const { app } = createApiApp({ secret: SECRET, store })

    const inviteResponse = await app.request('/api/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        boardId: 'board-123',
        role: 'editor'
      })
    })

    expect(inviteResponse.status).toBe(201)

    const inviteBody = (await inviteResponse.json()) as {
      invitationId: string
      token: string
      expiresAt: number
      url: string
    }

    expect(inviteBody.invitationId).toBeString()
    expect(inviteBody.token).toBeString()
    expect(inviteBody.url).toBe(`/invite/${inviteBody.token}`)
    expect(store.findInvitation(inviteBody.invitationId)?.boardId).toBe('board-123')

    const verifyResponse = await app.request('/api/invite/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: inviteBody.token
      })
    })

    expect(verifyResponse.status).toBe(200)
    expect(await verifyResponse.json()).toEqual({
      valid: true,
      invitation: {
        id: inviteBody.invitationId,
        boardId: 'board-123',
        role: 'editor',
        expiresAt: inviteBody.expiresAt
      }
    })
  })

  test('rejects revoked invitations', async () => {
    const store = createInvitationStore()
    const { app } = createApiApp({ secret: SECRET, store })

    const inviteResponse = await app.request('/api/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        boardId: 'board-123',
        role: 'viewer'
      })
    })
    const inviteBody = (await inviteResponse.json()) as {
      invitationId: string
      token: string
    }

    store.revokeInvitation(inviteBody.invitationId)

    const verifyResponse = await app.request('/api/invite/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: inviteBody.token
      })
    })

    expect(verifyResponse.status).toBe(401)
    expect(await verifyResponse.json()).toEqual({
      valid: false,
      reason: 'revoked'
    })
  })
})
