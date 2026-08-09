import { describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import {
  duplicateStorageDocument,
  type StorageDocumentMutationDependencies
} from '@/app/storage/documents'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'

import { recordingAdapter } from './sync/helpers'

const PROVIDER = 's3-compatible'
const TARGET = 's3-compatible#aaaaaaaa'
const BODY = new Uint8Array(512).fill(3)

/**
 * The mutation-feeder audit's duplicate link: a copy must route through the
 * persistence path with a fresh id and the source bytes — never mutate the
 * original. What persist then owes the outbox is the save mutation's job,
 * covered by the state-machine matrix. (A real persist would bind
 * `currentTargetIdFor(PROVIDER)`, which engine tests cannot configure —
 * preferences live outside these seams, so persist is spied here.)
 */
describe('duplicate feeder', () => {
  test('routes the copy through persist with a fresh id and the source bytes', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.writeCanvas({
      id: 'doc',
      syncTargetId: TARGET,
      name: 'Original',
      sourceFormat: 'fig',
      figBytes: BODY,
      bodyId: 'body-1'
    })
    const source: StorageDocument = {
      id: 'doc',
      name: 'Original',
      sourceFormat: 'fig',
      trashedAt: null,
      updatedAt: '2026-08-01T00:00:00.000Z',
      metadataAuthoritative: true
    }
    const persisted: Parameters<StorageDocumentMutationDependencies['persist']>[0][] = []
    const remoteJobs: string[] = []
    let created = 0
    const dependencies: StorageDocumentMutationDependencies = {
      store,
      adapter: recordingAdapter(),
      persist: async (options) => {
        persisted.push(options)
        return { revision: 1 }
      },
      enqueueMetadata: async (id) => {
        remoteJobs.push(id)
      },
      enqueueDelete: async (id) => {
        remoteJobs.push(id)
      },
      createId: () => `copy-${++created}`
    }

    const { document: copy } = await duplicateStorageDocument(
      PROVIDER,
      source,
      'Copy',
      dependencies
    )

    expect(copy.id).toBe('copy-1')
    expect(persisted).toHaveLength(1)
    expect(persisted[0]?.canvasId).toBe('copy-1')
    expect(persisted[0]?.name).toBe('Copy')
    expect([...(persisted[0]?.figBytes ?? [])]).toEqual([...BODY])
    // The original row is untouched and nothing was enqueued for it — the
    // copy is the only mutation, and persist (spied) owns its upload.
    expect(remoteJobs).toEqual([])
    const original = await store.getMeta('doc')
    expect(original?.name).toBe('Original')
    expect(original?.revision).toBe(1)
  })
})
