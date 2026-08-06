import { afterEach, describe, expect, test } from 'bun:test'

import { bodyKey, documentHeadKey, versionManifestKey } from '@/app/integrations/storage/namespace'
import { createS3StorageAdapterWithConfig } from '@/app/integrations/storage/s3/adapter'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'
import type { StorageDocumentMetadata } from '@/app/integrations/storage/types'
import { computeBodyIdSafe } from '@/app/storage/identity/body'
import { computeStateIdentity } from '@/app/storage/identity/state'

import { installMemoryS3 } from '#tests/helpers/memory-s3'

const CONFIG: S3CompatibleConfig = {
  endpoint: 'https://s3.example.test',
  bucket: 'bucket-1',
  accessKeyId: 'key-id',
  secretAccessKey: 'secret'
}

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

const adapter = createS3StorageAdapterWithConfig(async () => CONFIG)

async function writtenFor(name: string, bytes: Uint8Array): Promise<StorageDocumentMetadata> {
  const bodyId = await computeBodyIdSafe(bytes, 'fig')
  const { stateId } = await computeStateIdentity(bodyId, {
    name,
    sourceFormat: 'fig',
    isTrashed: false
  })
  return {
    name,
    updatedAt: '2026-08-04T12:00:00.000Z',
    sourceFormat: 'fig',
    trashedAt: null,
    bodyId,
    stateId
  }
}

const BODY = new TextEncoder().encode('the document bytes')

describe('versioned S3 adapter', () => {
  test('a commit writes body, manifest, then head — in that order', async () => {
    const mock = installMemoryS3(CONFIG)
    const written = await writtenFor('Doc', BODY)

    await adapter.putDocumentVersion('doc', BODY, async () => written)

    const puts = mock.requests.filter((request) => request.method === 'PUT').map((r) => r.key)
    expect(puts).toEqual([
      bodyKey(written.bodyId ?? ''),
      versionManifestKey(written.stateId ?? ''),
      documentHeadKey('doc')
    ])
  })

  test('identical bytes are never re-transferred', async () => {
    const mock = installMemoryS3(CONFIG)
    const first = await writtenFor('One', BODY)
    await adapter.putDocumentVersion('one', BODY, async () => first)
    const second = await writtenFor('Two', BODY)
    await adapter.putDocumentVersion('two', BODY, async () => second)

    const bodyPuts = mock.requests.filter(
      (request) => request.method === 'PUT' && request.key === bodyKey(first.bodyId ?? '')
    )
    expect(bodyPuts).toHaveLength(1)
    // Both documents resolve to the same bytes through their own heads.
    expect(await adapter.getDocument('one')).toEqual(BODY)
    expect(await adapter.getDocument('two')).toEqual(BODY)
  })

  test('a metadata-only version writes no body and grows the head history', async () => {
    const mock = installMemoryS3(CONFIG)
    const first = await writtenFor('Before', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => first)
    const bodyPutsBefore = mock.requests.filter(
      (r) => r.method === 'PUT' && r.key.startsWith('open_pencil_storage/bodies/')
    ).length

    const renamed = await writtenFor('After', BODY)
    await adapter.putMetadataVersion('doc', renamed)

    const bodyPutsAfter = mock.requests.filter(
      (r) => r.method === 'PUT' && r.key.startsWith('open_pencil_storage/bodies/')
    ).length
    expect(bodyPutsAfter).toBe(bodyPutsBefore)
    const metadata = await adapter.getDocumentMetadata('doc')
    expect(metadata?.name).toBe('After')
    expect(await adapter.getDocument('doc')).toEqual(BODY)
    const head = JSON.parse(new TextDecoder().decode(mock.objects.get(documentHeadKey('doc'))))
    expect(head.history).toEqual([renamed.stateId, first.stateId])
  })

  test('legacy documents list, open, and migrate on next write', async () => {
    installMemoryS3(CONFIG)
    // Seed the fixed-key layout directly.
    const legacyMeta: StorageDocumentMetadata = {
      name: 'Legacy',
      updatedAt: '2026-08-01T00:00:00.000Z',
      sourceFormat: 'fig',
      trashedAt: null
    }
    const legacyBytes = new TextEncoder().encode('legacy bytes')
    await adapter.putDocument('legacy', legacyBytes)
    await adapter.putDocumentMetadata('legacy', legacyMeta)

    const before = await adapter.listDocuments()
    expect(before.map((document) => document.name)).toEqual(['Legacy'])
    expect(await adapter.getDocument('legacy')).toEqual(legacyBytes)

    const migrated = await writtenFor('Legacy', legacyBytes)
    await adapter.putDocumentVersion('legacy', legacyBytes, async () => migrated)
    const after = await adapter.listDocuments()
    // Still exactly one document — the head wins, no duplicate row.
    expect(after).toHaveLength(1)
    expect(after[0]?.stateId).toBe(migrated.stateId)
  })

  test('crash between manifest and head leaves the previous version committed', async () => {
    const mock = installMemoryS3(CONFIG)
    const first = await writtenFor('V1', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => first)

    const otherBytes = new TextEncoder().encode('changed bytes')
    const second = await writtenFor('V2', otherBytes)
    mock.failOnce(documentHeadKey('doc'))
    await expect(
      adapter.putDocumentVersion('doc', otherBytes, async () => second)
    ).rejects.toThrow()

    // Readers still see V1: listing, metadata, and body.
    const listed = await adapter.listDocuments()
    expect(listed[0]?.name).toBe('V1')
    expect(await adapter.getDocument('doc')).toEqual(BODY)
    // The orphan manifest exists but is invisible to every read path.
    expect(mock.objects.has(versionManifestKey(second.stateId ?? ''))).toBe(true)
    const head = JSON.parse(new TextDecoder().decode(mock.objects.get(documentHeadKey('doc'))))
    expect(head.stateId).toBe(first.stateId)
  })

  test('crash between body and manifest leaves the previous state untouched', async () => {
    const mock = installMemoryS3(CONFIG)
    const orphanBytes = new TextEncoder().encode('orphan')
    const written = await writtenFor('Never', orphanBytes)
    mock.failOnce(versionManifestKey(written.stateId ?? ''))
    await expect(
      adapter.putDocumentVersion('doc', orphanBytes, async () => written)
    ).rejects.toThrow()

    expect(await adapter.listDocuments()).toEqual([])
    expect(mock.objects.has(bodyKey(written.bodyId ?? ''))).toBe(true)
    expect(mock.objects.has(documentHeadKey('doc'))).toBe(false)
  })

  test('delete removes the head but leaves bodies for the GC sweep', async () => {
    const mock = installMemoryS3(CONFIG)
    const written = await writtenFor('Doomed', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => written)

    await adapter.deleteDocument('doc')

    expect(await adapter.listDocuments()).toEqual([])
    expect(mock.objects.has(documentHeadKey('doc'))).toBe(false)
    expect(mock.objects.has(bodyKey(written.bodyId ?? ''))).toBe(true)
  })

  test('hasRemoteBody answers from the bodies prefix', async () => {
    installMemoryS3(CONFIG)
    const written = await writtenFor('Probe', BODY)
    expect(await adapter.hasRemoteBody?.(written.bodyId ?? '')).toBe(false)
    await adapter.putDocumentVersion('doc', BODY, async () => written)
    expect(await adapter.hasRemoteBody?.(written.bodyId ?? '')).toBe(true)
  })

  test('usage counts a versioned document once', async () => {
    installMemoryS3(CONFIG)
    const written = await writtenFor('Counted', BODY)
    await adapter.putDocumentVersion('doc', BODY, async () => written)

    const usage = await adapter.getUsage()
    // body + manifest + head = three objects, one document.
    expect(usage.objectCount).toBe(3)
    expect(usage.documentCount).toBe(1)
  })
})
