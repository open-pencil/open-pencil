import { describe, expect, test } from 'bun:test'

import { createApiApp } from '../../packages/api/src/server.js'

const SECRET = 'test-secret'

describe('board routes', () => {
  test('creates, lists, and deletes boards by anonymous owner', async () => {
    const { app } = createApiApp({ secret: SECRET })
    const createResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Product planning' })
    })

    expect(createResponse.status).toBe(201)
    const generatedAnonymousId = createResponse.headers.get('X-Inkly-Anonymous-Id')
    expect(generatedAnonymousId).toBeString()

    const createdBoard = (await createResponse.json()) as {
      id: string
      name: string
      creatorAnonymousId: string
      collaborators: Array<{ anonymousId: string; role: string }>
    }
    expect(createdBoard.name).toBe('Product planning')
    expect(createdBoard.creatorAnonymousId).toBe(generatedAnonymousId)
    expect(createdBoard.collaborators).toEqual([
      expect.objectContaining({
        anonymousId: generatedAnonymousId,
        role: 'owner'
      })
    ])

    const listResponse = await app.request('/api/boards', {
      headers: { 'X-Inkly-Anonymous-Id': generatedAnonymousId ?? '' }
    })
    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toEqual({
      boards: [expect.objectContaining({ id: createdBoard.id, name: 'Product planning' })]
    })

    const deleteResponse = await app.request(`/api/boards/${createdBoard.id}`, {
      method: 'DELETE',
      headers: { 'X-Inkly-Anonymous-Id': generatedAnonymousId ?? '' }
    })
    expect(deleteResponse.status).toBe(200)
    expect(await deleteResponse.json()).toEqual({ deleted: true })
  })

  test('rejects delete and invitation listing for non-owners', async () => {
    const { app } = createApiApp({ secret: SECRET })
    const ownerId = 'anon-owner'
    const createResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Inkly-Anonymous-Id': ownerId
      },
      body: JSON.stringify({ name: 'Marketing board' })
    })
    const board = (await createResponse.json()) as { id: string }

    const deleteResponse = await app.request(`/api/boards/${board.id}`, {
      method: 'DELETE',
      headers: { 'X-Inkly-Anonymous-Id': 'anon-stranger' }
    })
    expect(deleteResponse.status).toBe(403)

    const listInvitationsResponse = await app.request(`/api/boards/${board.id}/invitations`, {
      headers: { 'X-Inkly-Anonymous-Id': 'anon-stranger' }
    })
    expect(listInvitationsResponse.status).toBe(403)
  })

  test('lists invitations and accepted collaborators for the board owner', async () => {
    const { app } = createApiApp({ secret: SECRET })
    const ownerId = 'anon-owner'
    const createBoardResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Inkly-Anonymous-Id': ownerId
      },
      body: JSON.stringify({ name: 'Design system' })
    })
    const board = (await createBoardResponse.json()) as { id: string }

    const inviteResponse = await app.request('/api/invite', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Inkly-Anonymous-Id': ownerId
      },
      body: JSON.stringify({
        email: 'guest@example.com',
        boardId: board.id,
        role: 'editor'
      })
    })
    expect(inviteResponse.status).toBe(201)
    const invite = (await inviteResponse.json()) as { invitationId: string; token: string }

    const verifyResponse = await app.request('/api/invite/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Inkly-Anonymous-Id': 'anon-guest'
      },
      body: JSON.stringify({ token: invite.token })
    })
    expect(verifyResponse.status).toBe(200)

    const invitationsResponse = await app.request(`/api/boards/${board.id}/invitations`, {
      headers: { 'X-Inkly-Anonymous-Id': ownerId }
    })
    expect(invitationsResponse.status).toBe(200)

    expect(await invitationsResponse.json()).toEqual({
      board: expect.objectContaining({
        id: board.id,
        collaborators: expect.arrayContaining([
          expect.objectContaining({ anonymousId: ownerId, role: 'owner' }),
          expect.objectContaining({
            anonymousId: 'anon-guest',
            role: 'editor',
            invitationId: invite.invitationId
          })
        ])
      }),
      invitations: [expect.objectContaining({ id: invite.invitationId, boardId: board.id })]
    })
  })
})
