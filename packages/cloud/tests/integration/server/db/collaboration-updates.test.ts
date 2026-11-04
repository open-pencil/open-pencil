import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { createCollaborationStateStore } from '#cloud/server'
import { startRoomsOver } from '#cloud/server/db/migrations/028_collaboration_updates'

describe('migration 028', () => {
  test('moves documents with saved rooms to a new epoch and drops those rooms', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const { database } = runtime
      const workspaceId = crypto.randomUUID()
      const shared = crypto.randomUUID()
      const solo = crypto.randomUUID()
      await database
        .insertInto('workspace')
        .values({ id: workspaceId, name: 'Studio', slug: 'studio', createdBy: 'alice' })
        .execute()
      await database
        .insertInto('document')
        .values([
          { id: shared, workspaceId, name: 'Poster', createdBy: 'alice' },
          { id: solo, workspaceId, name: 'Blank', createdBy: 'alice' }
        ])
        .execute()
      const store = createCollaborationStateStore(database, createMemoryObjectStore().store)
      await store.compact({ documentId: shared, roomEpoch: 0 }, 0, Uint8Array.from([1]))

      await startRoomsOver(database)

      const epochs = await database
        .selectFrom('document')
        .select(['id', 'collaborationEpoch'])
        .orderBy('name')
        .execute()
      expect(epochs).toEqual([
        { id: solo, collaborationEpoch: 0 },
        { id: shared, collaborationEpoch: 1 }
      ])
      expect(await database.selectFrom('documentRoomSnapshot').selectAll().execute()).toEqual([])
    } finally {
      await runtime.close()
    }
  })
})
