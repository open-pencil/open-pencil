import { describe, expect, test } from 'bun:test'

import { TEST_API_SECRET, createTestApiApp } from '../helpers/api.js'

describe('invite routes', () => {
  test('creates and verifies an invitation', async () => {
    const { app, database, store } = await createTestApiApp({ secret: TEST_API_SECRET })

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
    expect((await store.findInvitation(inviteBody.invitationId))?.boardId).toBe('board-123')

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
    database.close()
  })

  test('rejects revoked invitations', async () => {
    const { app, database, store } = await createTestApiApp({ secret: TEST_API_SECRET })

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

    await store.revokeInvitation(inviteBody.invitationId)

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
    database.close()
  })
})
