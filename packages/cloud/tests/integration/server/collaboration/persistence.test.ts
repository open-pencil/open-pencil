import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { createCollaborationStateStore, createRevisionCompactionService } from '#cloud/server'
import { unreferencedObject } from '#cloud/server/cleanup/objects'

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
  const objects = createMemoryObjectStore()
  return {
    runtime,
    objects,
    store: createCollaborationStateStore(runtime.database, objects.store),
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

      // Compacting again with the same arguments, as after an unknown result, leaves the same room.
      await store.compact(room, 3, bytes(8))
      await store.compact(room, 3, bytes(8))
      expect(await store.load(room)).toEqual({ snapshot: bytes(8), updates: [], sequence: 3 })
      const logged = await runtime.database
        .selectFrom('documentRoomUpdate')
        .select('sequence')
        .execute()
      expect(logged).toEqual([])
    } finally {
      await runtime.close()
    }
  })

  test('keeps rooms of other epochs apart, and writes nothing for an epoch a restore replaced', async () => {
    const { runtime, store, room } = await storedRoom()
    try {
      await store.append(room, 1, bytes(1))
      // A restore advances the document's epoch; the earlier room never opens again.
      await runtime.database
        .updateTable('document')
        .set({ collaborationEpoch: 1 })
        .where('id', '=', room.documentId)
        .execute()
      const restored = { ...room, roomEpoch: 1 }
      await store.append(restored, 1, bytes(2))
      await store.compact(restored, 1, bytes(5))
      expect(await store.load(restored)).toEqual({ snapshot: bytes(5), updates: [], sequence: 1 })

      // A save of the replaced room that lands late changes nothing.
      await store.append(room, 2, bytes(3))
      await store.compact(room, 2, bytes(6))
      expect(await store.load(room)).toEqual({ snapshot: null, updates: [bytes(1)], sequence: 1 })
    } finally {
      await runtime.close()
    }
  })

  test('keeps snapshots as stored files the database only names, and frees the ones it replaced', async () => {
    const { runtime, store, room, objects } = await storedRoom()
    try {
      await store.compact(room, 0, bytes(1, 1))
      await store.compact(room, 0, bytes(2, 2))
      expect((await store.load(room)).snapshot).toEqual(bytes(2, 2))

      const files = await runtime.database
        .selectFrom('storageObject')
        .select(['objectKey', 'byteSize'])
        .where('objectKey', 'like', `collaboration/${room.documentId}/0/%`)
        .execute()
      expect(files).toHaveLength(2)
      expect(await objects.store.read(files[0]?.objectKey ?? '')).not.toBeNull()
      // The replaced snapshot is referenced by nothing, so the object sweep removes it.
      const freed = await runtime.database
        .selectFrom('storageObject')
        .select('objectKey')
        .where('objectKey', 'like', `collaboration/${room.documentId}/0/%`)
        .where(unreferencedObject)
        .execute()
      expect(freed).toHaveLength(1)
      expect(await objects.store.read(freed[0]?.objectKey ?? '')).toEqual(bytes(1, 1))
    } finally {
      await runtime.close()
    }
  })

  test('records a snapshot written for a replaced epoch, so the sweep frees it', async () => {
    const { runtime, store, room } = await storedRoom()
    try {
      await runtime.database
        .updateTable('document')
        .set({ collaborationEpoch: 1 })
        .where('id', '=', room.documentId)
        .execute()
      await store.compact(room, 0, bytes(3))
      const files = await runtime.database
        .selectFrom('storageObject')
        .select('objectKey')
        .where('objectKey', 'like', `collaboration/${room.documentId}/0/%`)
        .where(unreferencedObject)
        .execute()
      expect(files).toHaveLength(1)
      expect((await store.load(room)).snapshot).toBeNull()
    } finally {
      await runtime.close()
    }
  })

  test('leaves the room as it was when a snapshot cannot be written, and its file to the sweep', async () => {
    const { runtime, room, objects } = await storedRoom()
    try {
      const store = createCollaborationStateStore(runtime.database, objects.store)
      await store.compact(room, 0, bytes(1))
      const failing = createCollaborationStateStore(runtime.database, {
        ...objects.store,
        async write() {
          throw new Error('Object store unavailable')
        }
      })
      await expect(failing.compact(room, 0, bytes(2))).rejects.toThrow('Object store unavailable')

      expect((await store.load(room)).snapshot).toEqual(bytes(1))
      const unreferenced = await runtime.database
        .selectFrom('storageObject')
        .select('objectKey')
        .where('objectKey', 'like', `collaboration/${room.documentId}/0/%`)
        .where(unreferencedObject)
        .execute()
      expect(unreferenced).toHaveLength(1)
    } finally {
      await runtime.close()
    }
  })

  test('sweeps a replaced snapshot only once a compaction could no longer be writing it', async () => {
    const { runtime, store, room, objects } = await storedRoom()
    try {
      await store.compact(room, 0, bytes(1))
      await store.compact(room, 0, bytes(2))
      const sweep = (minutes: number) =>
        createRevisionCompactionService(runtime.database, objects.store).compactRevisions({
          batchSize: 100,
          graceMs: 24 * 60 * 60_000,
          now: new Date(Date.now() + minutes * 60_000)
        })
      expect((await sweep(1)).objectsDeleted).toBe(0)
      expect((await sweep(20)).objectsDeleted).toBe(1)
      expect((await store.load(room)).snapshot).toEqual(bytes(2))
    } finally {
      await runtime.close()
    }
  })
})
