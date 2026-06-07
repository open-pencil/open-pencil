import { describe, expect, test } from 'bun:test'

import type { InklyAuth, InklyAuthSession } from '../../../packages/api/src/auth/index.js'
import { users } from '../../../packages/api/src/db/schema.js'
import { TEST_API_SECRET, createTestApiApp } from '../../helpers/api.js'

function createSession(userId = 'user-123'): InklyAuthSession {
  return {
    session: {
      id: `session-${userId}`,
      token: `token-${userId}`,
      userId,
      expiresAt: '2030-01-01T00:00:00.000Z',
      createdAt: '2029-01-01T00:00:00.000Z',
      updatedAt: '2029-01-01T00:00:00.000Z'
    },
    user: {
      id: userId,
      name: 'Migrated User',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      createdAt: '2029-01-01T00:00:00.000Z',
      updatedAt: '2029-01-01T00:00:00.000Z'
    }
  }
}

function createAuth(session = createSession()): InklyAuth {
  return {
    async handler() {
      return Response.json(session)
    },
    async getSession() {
      return session
    }
  }
}

async function seedUser(
  database: Awaited<ReturnType<typeof createTestApiApp>>['database'],
  session: InklyAuthSession
) {
  await database.db
    .insert(users)
    .values({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      image: session.user.image,
      createdAt: new Date(session.user.createdAt),
      updatedAt: new Date(session.user.updatedAt)
    })
    .run()
}

describe('auth anonymous migration route', () => {
  test('rebinds anonymous board ownership to the current user and preserves invitation access', async () => {
    const session = createSession()
    const { app, boardStore, store, database } = await createTestApiApp({
      auth: createAuth(session),
      secret: TEST_API_SECRET
    })
    await seedUser(database, session)

    const board = await boardStore.createBoard({
      name: 'Anonymous board',
      creatorAnonymousId: 'anon-owner'
    })
    const invitation = await store.createInvitation({
      boardId: board.id,
      sentToEmailHash: 'hash-123',
      role: 'editor',
      expiresAt: Date.now() + 60_000
    })

    const beforeMigration = await app.request(`/api/boards/${board.id}/invitations`)
    expect(beforeMigration.status).toBe(403)

    const response = await app.request('/api/auth/migrate-anonymous', {
      method: 'POST',
      headers: {
        'X-Inkly-Anonymous-Id': 'anon-owner'
      }
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      migrated: true,
      migratedBoardCount: 1,
      removedOwnerCollaboratorCount: 1
    })

    const migratedBoard = await boardStore.findBoard(board.id)
    expect(migratedBoard).toEqual(
      expect.objectContaining({
        id: board.id,
        creatorAnonymousId: '',
        creatorUserId: 'user-123'
      })
    )
    expect(migratedBoard?.collaborators).toEqual([])
    expect(await boardStore.listBoardsForAnonymous('anon-owner')).toEqual([])
    expect(await boardStore.listBoardsForUser('user-123')).toEqual([
      expect.objectContaining({ id: board.id, creatorUserId: 'user-123' })
    ])

    const afterMigration = await app.request(`/api/boards/${board.id}/invitations`)
    expect(afterMigration.status).toBe(200)
    expect(await afterMigration.json()).toEqual({
      board: expect.objectContaining({
        id: board.id,
        creatorUserId: 'user-123'
      }),
      invitations: [expect.objectContaining({ id: invitation.id, boardId: board.id })]
    })

    database.close()
  })

  test('is idempotent when the same anonymous id is migrated twice', async () => {
    const session = createSession('user-456')
    const { app, boardStore, database } = await createTestApiApp({
      auth: createAuth(session),
      secret: TEST_API_SECRET
    })
    await seedUser(database, session)

    const board = await boardStore.createBoard({
      name: 'Repeatable board',
      creatorAnonymousId: 'anon-repeat'
    })

    const firstResponse = await app.request('/api/auth/migrate-anonymous', {
      method: 'POST',
      headers: {
        'X-Inkly-Anonymous-Id': 'anon-repeat'
      }
    })
    expect(firstResponse.status).toBe(200)
    expect(await firstResponse.json()).toEqual({
      migrated: true,
      migratedBoardCount: 1,
      removedOwnerCollaboratorCount: 1
    })

    const secondResponse = await app.request('/api/auth/migrate-anonymous', {
      method: 'POST',
      headers: {
        'X-Inkly-Anonymous-Id': 'anon-repeat'
      }
    })
    expect(secondResponse.status).toBe(200)
    expect(await secondResponse.json()).toEqual({
      migrated: false,
      migratedBoardCount: 0,
      removedOwnerCollaboratorCount: 0
    })

    expect(await boardStore.findBoard(board.id)).toEqual(
      expect.objectContaining({
        id: board.id,
        creatorAnonymousId: '',
        creatorUserId: 'user-456'
      })
    )

    database.close()
  })
})
