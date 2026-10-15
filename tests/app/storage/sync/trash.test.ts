import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { fallbackDocumentMetadata } from '@/app/integrations/storage/metadata'
import {
  documentHeadKey,
  documentMetaKey,
  versionManifestKey
} from '@/app/integrations/storage/namespace'
import { parseDocumentHead } from '@/app/integrations/storage/versioned/head'
import { parseVersionManifest } from '@/app/integrations/storage/versioned/manifest'

import { writtenFor } from '#tests/helpers/storage/documents'
import {
  DESTINATION,
  PROVIDER,
  createSyncHarness,
  type SyncHarness
} from '#tests/helpers/storage/sync-harness'

let harness: SyncHarness

beforeEach(() => {
  harness = createSyncHarness()
})

afterEach(() => {
  harness.dispose()
})

/** A design another device committed, seeded index-only the way the library listing seeds it. */
async function listedDesign(
  id: string,
  options: { sourceFormat?: 'fig' | 'deck' } = {}
): Promise<string> {
  const bytes = new TextEncoder().encode(`${id} body`)
  const written = await writtenFor(id, bytes, options)
  await harness.adapter.putDocumentVersion(id, bytes, async () => written)
  await harness.store.upsertIndexMeta({
    id,
    providerId: PROVIDER,
    name: id,
    updatedAt: written.updatedAt,
    sourceFormat: written.sourceFormat,
    trashedAt: null,
    syncStatus: 'synced',
    lastSyncedAt: written.updatedAt,
    lastSyncError: null,
    syncedBodyId: written.bodyId ?? null,
    baseStateId: written.stateId ?? null,
    versionedConfirmed: true,
    syncDestination: DESTINATION
  })
  return written.bodyId ?? ''
}

/** What trash and restore do to a row: a local edit, then a metadata-only commit. */
async function setTrashed(id: string, trashedAt: string | null): Promise<void> {
  const row = await harness.store.getMeta(id)
  const updated = await harness.store.updateMeta(id, {
    trashedAt,
    updatedAt: '2026-08-05T00:00:00.000Z',
    revision: (row?.revision ?? 0) + 1,
    syncStatus: 'pending'
  })
  await harness.engine.enqueue(id, 'putMetadata', updated?.revision ?? 0)
  await harness.drain()
}

function headManifest(id: string) {
  const head = parseDocumentHead(harness.bucket.objects.get(documentHeadKey(id)) ?? null)
  return parseVersionManifest(
    harness.bucket.objects.get(versionManifestKey(head?.stateId ?? '')) ?? null,
    fallbackDocumentMetadata(id)
  )?.manifest
}

describe('trash in remote metadata', () => {
  test('trashing a design never opened here commits a manifest and no body', async () => {
    const bodyId = await listedDesign('doc')
    const bodyPuts = () =>
      harness.bucket.requests.filter(
        (request) => request.method === 'PUT' && request.key.includes('/bodies/')
      ).length
    const before = bodyPuts()

    await setTrashed('doc', '2026-08-05T00:00:00.000Z')

    expect(bodyPuts()).toBe(before)
    expect(headManifest('doc')).toMatchObject({
      bodyId,
      metadata: { trashedAt: '2026-08-05T00:00:00.000Z' }
    })
    expect((await harness.adapter.listDocuments())[0]?.trashedAt).not.toBeNull()

    await setTrashed('doc', null)
    expect(headManifest('doc')?.metadata.trashedAt).toBeNull()
  })

  test('a slide deck’s trash commit keeps it a deck with its own body', async () => {
    const bodyId = await listedDesign('slides', { sourceFormat: 'deck' })

    await setTrashed('slides', '2026-08-05T00:00:00.000Z')

    expect(headManifest('slides')).toMatchObject({ bodyId, metadata: { sourceFormat: 'deck' } })
  })

  test('a design still in the legacy layout records its trash in the sidecar', async () => {
    harness.bucket.seed(
      documentMetaKey('legacy'),
      JSON.stringify({ name: 'Legacy', updatedAt: '2026-08-01T00:00:00.000Z' })
    )
    await harness.store.upsertIndexMeta({
      id: 'legacy',
      providerId: PROVIDER,
      name: 'Legacy',
      updatedAt: '2026-08-01T00:00:00.000Z',
      syncStatus: 'synced',
      lastSyncedAt: '2026-08-01T00:00:00.000Z',
      lastSyncError: null,
      syncDestination: DESTINATION
    })

    await setTrashed('legacy', '2026-08-05T00:00:00.000Z')

    const sidecar = new TextDecoder().decode(harness.bucket.objects.get(documentMetaKey('legacy')))
    expect(sidecar).toContain('"trashedAt":"2026-08-05T00:00:00.000Z"')
    expect(harness.bucket.objects.has(documentHeadKey('legacy'))).toBe(false)
  })
})

describe('permanent delete', () => {
  test('removes the head of a design trashed everywhere', async () => {
    await listedDesign('doc')
    await setTrashed('doc', '2026-08-05T00:00:00.000Z')

    await harness.store.tombstone('doc')
    await harness.engine.enqueue('doc', 'deleteCanvas', 0)
    await harness.drain()

    expect(harness.bucket.objects.has(documentHeadKey('doc'))).toBe(false)
  })

  test('is abandoned when another device restored the design meanwhile', async () => {
    await listedDesign('doc')
    await setTrashed('doc', '2026-08-05T00:00:00.000Z')
    // Another device restores it with an edit of its own.
    const restored = new TextEncoder().encode('restored elsewhere')
    const written = await writtenFor('Restored', restored)
    await harness.adapter.putDocumentVersion('doc', restored, async () => written)

    await harness.store.tombstone('doc')
    await harness.engine.enqueue('doc', 'deleteCanvas', 0)
    await harness.drain()

    expect(harness.bucket.objects.has(documentHeadKey('doc'))).toBe(true)
    expect(await harness.store.getMeta('doc')).toMatchObject({
      tombstoned: false,
      trashedAt: null,
      name: 'Restored',
      baseStateId: written.stateId
    })
  })
})
