import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createCollaborationStateStore } from '#cloud/server'

async function storedRoom() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'Design', slug: `design-${workspaceId}`, createdBy: 'owner' })
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Homepage', createdBy: 'owner' })
    .execute()
  return {
    runtime,
    store: createCollaborationStateStore(runtime.database),
    room: { documentId, roomEpoch: 0 }
  }
}

const bytes = (...values: number[]) => Uint8Array.from(values)

describe('collaboration state store', () => {
  test('logs updates in order and folds them into a snapshot', async () => {
    const { runtime, store, room } = await storedRoom()
    try {
      expect(await store.load(room)).toEqual({ snapshot: null, updates: [], sequence: 0 })

      await store.append(room, 1, bytes(1))
      await store.append(room, 2, bytes(2))
      expect(await store.load(room)).toEqual({
        snapshot: null,
        updates: [bytes(1), bytes(2)],
        sequence: 2
      })
      await expect(store.append(room, 2, bytes(9))).rejects.toThrow()

      await store.compact(room, 2, bytes(7, 7))
      await store.append(room, 3, bytes(3))
      expect(await store.load(room)).toEqual({
        snapshot: bytes(7, 7),
        updates: [bytes(3)],
        sequence: 3
      })

      // Compacting again with the same arguments, as after an unknown result, changes nothing.
      await store.compact(room, 3, bytes(8))
      await store.compact(room, 3, bytes(8))
      expect(await store.load(room)).toEqual({ snapshot: bytes(8), updates: [], sequence: 3 })
      const logged = await runtime.database
        .selectFrom('documentCollaborationUpdate')
        .select('sequence')
        .execute()
      expect(logged).toEqual([])
    } finally {
      await runtime.close()
    }
  })

  test('keeps rooms of other epochs apart', async () => {
    const { runtime, store, room } = await storedRoom()
    try {
      await store.append(room, 1, bytes(1))
      const restored = { ...room, roomEpoch: 1 }
      await store.append(restored, 1, bytes(2))
      await store.compact(restored, 1, bytes(5))
      expect((await store.load(room)).updates).toEqual([bytes(1)])
      expect(await store.load(restored)).toEqual({ snapshot: bytes(5), updates: [], sequence: 1 })
    } finally {
      await runtime.close()
    }
  })
})
