import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { StorageConflictError } from '@/app/integrations/storage/conflict'
import {
  bodyKey,
  documentFigKey,
  documentHeadKey,
  documentMetaKey,
  documentThumbnailKey,
  versionManifestKey
} from '@/app/integrations/storage/namespace'
import { createS3StorageAdapterWithConfig } from '@/app/integrations/storage/s3/adapter'
import { parseDocumentHead } from '@/app/integrations/storage/versioned/head'
import { clearVersionManifestCache } from '@/app/integrations/storage/versioned/manifest-cache'

import { fakePNG, figArchive, writtenFor } from '#tests/helpers/storage/documents'
import { MEMORY_S3_CONFIG, installMemoryS3, type MemoryS3 } from '#tests/helpers/storage/memory-s3'

const adapter = createS3StorageAdapterWithConfig(async () => MEMORY_S3_CONFIG)
const BODY = new TextEncoder().encode('the document bytes')

let bucket: MemoryS3

beforeEach(() => {
  clearVersionManifestCache()
  bucket = installMemoryS3()
})

afterEach(() => {
  bucket.restore()
})

function puts(): string[] {
  return bucket.requests.filter((request) => request.method === 'PUT').map((r) => r.key)
}

function head(id: string) {
  return parseDocumentHead(bucket.objects.get(documentHeadKey(id)) ?? null)
}

describe('versioned S3 adapter', () => {
  test('a commit reads the head once, then writes body, manifest, and head in that order', async () => {
    const written = await writtenFor('Doc', BODY)

    await adapter.putDocumentVersion('doc', BODY, async () => written)

    expect(puts()).toEqual([
      bodyKey(written.bodyId ?? ''),
      versionManifestKey(written.stateId ?? ''),
      documentHeadKey('doc')
    ])
    expect(bucket.requests.filter((request) => request.method === 'HEAD')).toEqual([])
    expect(
      bucket.requests.filter(
        (request) => request.method === 'GET' && request.key === documentHeadKey('doc')
      )
    ).toHaveLength(1)
  })

  test('a retry skips a body that is already stored', async () => {
    const first = await writtenFor('One', BODY)
    await adapter.putDocumentVersion('one', BODY, async () => first)
    const second = await writtenFor('Two', BODY)

    await adapter.putDocumentVersion('two', BODY, async () => second, undefined, { retry: true })

    expect(puts().filter((key) => key === bodyKey(first.bodyId ?? ''))).toHaveLength(1)
    expect(await adapter.getDocument('two')).toEqual(BODY)
  })

  test('a metadata-only version writes no body and grows the head history', async () => {
    const first = await writtenFor('Before', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => first)
    const renamed = await writtenFor('After', BODY)

    await adapter.putMetadataVersion('doc', renamed)

    expect(puts().filter((key) => key.startsWith('open_pencil_storage/bodies/'))).toHaveLength(1)
    expect((await adapter.getDocumentMetadata?.('doc'))?.name).toBe('After')
    expect(await adapter.getDocument('doc')).toEqual(BODY)
    expect(head('doc')?.history).toEqual([renamed.stateId ?? '', first.stateId ?? ''])
  })

  test('a commit whose state the head already holds writes nothing', async () => {
    const written = await writtenFor('Same', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => written)
    const before = puts().length

    const committed = await adapter.putDocumentVersion('doc', BODY, async () => written)

    expect(puts()).toHaveLength(before)
    expect(committed.stateId).toBe(written.stateId ?? '')
  })

  test('a head that moved past every known state refuses the commit before any write', async () => {
    const theirs = await writtenFor('Theirs', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => theirs)
    const before = puts().length
    const mine = await writtenFor('Mine', new TextEncoder().encode('my edit'))

    await expect(
      adapter.putDocumentVersion('doc', BODY, async () => mine, undefined, {
        expectedBase: { baseStateId: 'sha256:older', lastPublishedStateId: null }
      })
    ).rejects.toBeInstanceOf(StorageConflictError)
    expect(puts()).toHaveLength(before)
  })

  test('a rename during the upload is in the committed manifest', async () => {
    const dispatched = await writtenFor('Before', BODY)
    const renamed = await writtenFor('Renamed', BODY)
    let reads = 0

    const committed = await adapter.putDocumentVersion('doc', BODY, async () =>
      reads++ === 0 ? dispatched : renamed
    )

    expect(committed.stateId).toBe(renamed.stateId ?? '')
    expect((await adapter.getDocumentMetadata?.('doc'))?.name).toBe('Renamed')
  })

  test('legacy documents list and open, and the head wins once they are versioned', async () => {
    const legacyBytes = new TextEncoder().encode('legacy bytes')
    bucket.seed(documentFigKey('legacy'), legacyBytes)
    bucket.seed(
      documentMetaKey('legacy'),
      JSON.stringify({ name: 'Legacy', updatedAt: '2026-08-01T00:00:00.000Z' })
    )

    const before = await adapter.listDocuments()
    expect(before).toMatchObject([{ id: 'legacy', name: 'Legacy', versioned: false }])
    expect(await adapter.getDocument('legacy')).toEqual(legacyBytes)

    const migrated = await writtenFor('Legacy', legacyBytes)
    await adapter.putDocumentVersion('legacy', legacyBytes, async () => migrated)
    const after = await adapter.listDocuments()
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ stateId: migrated.stateId, versioned: true })
    // Legacy objects stay until the design is permanently deleted.
    expect(bucket.objects.has(documentFigKey('legacy'))).toBe(true)
  })

  test('a slide deck is listed as a deck with its stored preview', async () => {
    const deck = new TextEncoder().encode('deck bytes')
    const written = await writtenFor('Slides', deck, { sourceFormat: 'deck' })
    await adapter.putDocumentVersion('deck-1', deck, async () => written)
    const preview = fakePNG()
    bucket.seed(documentThumbnailKey('deck-1'), preview)

    const [listed] = await adapter.listDocuments()

    expect(listed).toMatchObject({ id: 'deck-1', sourceFormat: 'deck', bodyId: written.bodyId })
    expect(await adapter.getThumbnail?.('deck-1')).toEqual(preview)
  })

  test('the preview of a versioned design is read from its committed body', async () => {
    const thumbnail = fakePNG()
    const bytes = figArchive('canvas', thumbnail)
    const written = await writtenFor('Preview', bytes)
    await adapter.putDocumentVersion('doc', bytes, async () => written)

    expect(await adapter.getThumbnail?.('doc')).toEqual(thumbnail)
    expect(
      bucket.requests.some(
        (request) => request.key === bodyKey(written.bodyId ?? '') && request.range !== null
      )
    ).toBe(true)
  })

  test('a crash between manifest and head leaves the previous version committed', async () => {
    const first = await writtenFor('V1', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => first)
    const changed = new TextEncoder().encode('changed bytes')
    const second = await writtenFor('V2', changed)
    bucket.failOnce(documentHeadKey('doc'))

    await expect(adapter.putDocumentVersion('doc', changed, async () => second)).rejects.toThrow()

    expect((await adapter.listDocuments())[0]?.name).toBe('V1')
    expect(await adapter.getDocument('doc')).toEqual(BODY)
    expect(head('doc')?.stateId).toBe(first.stateId ?? '')
  })

  test('the version read reports the committed state and the head history', async () => {
    const written = await writtenFor('Opened', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => written)

    const version = await adapter.getDocumentVersion?.('doc')

    expect(version).toMatchObject({
      bytes: BODY,
      versioned: true,
      history: [written.stateId],
      metadata: { name: 'Opened', bodyId: written.bodyId, stateId: written.stateId }
    })
  })

  test('delete removes the head and legacy objects but leaves bodies for collection', async () => {
    const written = await writtenFor('Doomed', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => written)
    bucket.seed(documentFigKey('doc'), BODY)
    bucket.seed(documentMetaKey('doc'), '{}')

    await adapter.deleteDocument('doc')

    expect(await adapter.listDocuments()).toEqual([])
    expect([...bucket.objects.keys()].filter((key) => key.includes('/canvases/'))).toEqual([])
    expect(bucket.objects.has(bodyKey(written.bodyId ?? ''))).toBe(true)
  })

  test('usage counts a versioned document once', async () => {
    const written = await writtenFor('Counted', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => written)
    bucket.seed(documentFigKey('doc'), BODY)

    const usage = await adapter.getUsage()

    expect(usage.objectCount).toBe(4)
    expect(usage.documentCount).toBe(1)
  })
})
