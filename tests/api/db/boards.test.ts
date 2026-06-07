import { afterEach, describe, expect, test } from 'bun:test'

import { createBoardStore } from '../../../packages/api/src/boardStore.js'
import { createTestApiDatabase } from '../../helpers/api.js'

const databases: Array<{ close: () => void }> = []

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close()
  }
})

describe('db-backed board store', () => {
  test('persists board CRUD and collaborators in memory sqlite', async () => {
    const database = await createTestApiDatabase()
    databases.push(database)
    const store = await createBoardStore({
      database,
      now: () => 1_234_567_890
    })

    const board = await store.createBoard({
      name: 'Persistent board',
      creatorAnonymousId: 'anon-owner'
    })

    expect(await store.findBoard(board.id)).toEqual(board)
    expect(await store.listBoardsForAnonymous('anon-owner')).toEqual([board])

    const updated = await store.addCollaborator(board.id, {
      anonymousId: 'anon-guest',
      role: 'editor',
      invitationId: 'invite-123'
    })

    expect(updated).toEqual(
      expect.objectContaining({
        id: board.id,
        name: 'Persistent board',
        creatorAnonymousId: 'anon-owner',
        createdAt: 1_234_567_890,
        updatedAt: 1_234_567_890,
        collaborators: expect.arrayContaining([
          expect.objectContaining({ anonymousId: 'anon-owner', role: 'owner' }),
          expect.objectContaining({
            anonymousId: 'anon-guest',
            role: 'editor',
            invitationId: 'invite-123'
          })
        ])
      })
    )
    expect(await store.listBoardsForAnonymous('anon-guest')).toEqual([expect.objectContaining({ id: board.id })])

    const deleted = await store.deleteBoard(board.id)

    expect(deleted).toEqual(expect.objectContaining({ id: board.id }))
    expect(await store.findBoard(board.id)).toBeNull()
    expect(await store.listBoardsForAnonymous('anon-owner')).toEqual([])
  })
})
