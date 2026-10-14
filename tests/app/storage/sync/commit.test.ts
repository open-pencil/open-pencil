import { describe, expect, test } from 'bun:test'

import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { markRevisionSynced } from '@/app/storage/sync/commit'

import { figArchive } from '#tests/helpers/storage/documents'

describe('recording a commit', () => {
  test('a state no head holds becomes the base but not a publish', async () => {
    const store = createMemoryLocalCanvasStore()
    const meta = await store.writeCanvas({
      id: 'legacy',
      providerId: 's3-compatible',
      name: 'Legacy',
      figBytes: figArchive('legacy')
    })

    await markRevisionSynced(store, 'legacy', meta.revision, {
      stateId: 'sha256:sidecar',
      publish: false
    })

    const row = await store.getMeta('legacy')
    expect(row?.baseStateId).toBe('sha256:sidecar')
    // A publish no head holds would read as a fork once another device moves the design on.
    expect(row?.lastPublishedStateId ?? null).toBeNull()
  })
})
