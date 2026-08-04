import { afterEach, describe, expect, test } from 'bun:test'

import { bodyKey, versionManifestKey } from '@/app/integrations/storage/namespace'
import { createS3StorageAdapterWithConfig } from '@/app/integrations/storage/s3/adapter'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'
import type { StorageDocumentMetadata } from '@/app/integrations/storage/types'
import { serializeVersionManifest } from '@/app/integrations/storage/versioned/manifest'
import { computeBodyIdSafe } from '@/app/storage/identity/body'
import { computeStateIdentity } from '@/app/storage/identity/state'

import { installMemoryS3 } from '#tests/helpers/memory-s3'

const CONFIG: S3CompatibleConfig = {
  endpoint: 'https://s3.example.test',
  bucket: 'bucket-1',
  accessKeyId: 'key-id',
  secretAccessKey: 'secret'
}

// Objects in the mock default to 2026-08-04T00:00; a sweep two days later sees
// them as old, and a 2026-08-05T23:00 timestamp as young (1 h before now).
const NOW_OLD = Date.parse('2026-08-06T00:00:00.000Z')
const YOUNG_ISO = '2026-08-05T23:00:00.000Z'

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

function seedOrphan(
  mock: ReturnType<typeof installMemoryS3>,
  stateId: string,
  bodyId: string
): void {
  mock.objects.set(
    versionManifestKey(stateId),
    new TextEncoder().encode(
      serializeVersionManifest({
        schema: 1,
        bodyId,
        metadata: {
          name: 'orphan',
          updatedAt: '2026-08-04T00:00:00.000Z',
          sourceFormat: 'fig',
          trashedAt: null
        }
      })
    )
  )
  mock.objects.set(bodyKey(bodyId), new TextEncoder().encode('orphan body'))
}

describe('versioned garbage collection', () => {
  test('old unreferenced bodies and manifests are collected; retained ones are not', async () => {
    const mock = installMemoryS3(CONFIG)
    const bytes = new TextEncoder().encode('retained bytes')
    const written = await writtenFor('Kept', bytes)
    await adapter.putDocumentVersion('doc', bytes, async () => written)
    seedOrphan(mock, 'sha256:orphanstate', 'sha256:orphanbody')

    const result = await adapter.collectGarbage?.(NOW_OLD)

    expect(result?.deletedBodies).toBe(1)
    expect(result?.deletedManifests).toBe(1)
    expect(mock.objects.has(bodyKey('sha256:orphanbody'))).toBe(false)
    expect(mock.objects.has(versionManifestKey('sha256:orphanstate'))).toBe(false)
    // The committed document survives intact.
    expect(await adapter.getDocument('doc')).toEqual(bytes)
  })

  test('young orphans are never touched', async () => {
    const mock = installMemoryS3(CONFIG)
    seedOrphan(mock, 'sha256:orphanstate', 'sha256:orphanbody')
    mock.setLastModified(versionManifestKey('sha256:orphanstate'), YOUNG_ISO)
    mock.setLastModified(bodyKey('sha256:orphanbody'), YOUNG_ISO)

    const result = await adapter.collectGarbage?.(NOW_OLD)

    expect(result?.deletedBodies).toBe(0)
    expect(result?.deletedManifests).toBe(0)
    expect(mock.objects.has(bodyKey('sha256:orphanbody'))).toBe(true)
  })

  test('a body referenced by a retained manifest survives another document’s delete', async () => {
    const mock = installMemoryS3(CONFIG)
    const shared = new TextEncoder().encode('identical bytes')
    const first = await writtenFor('One', shared)
    await adapter.putDocumentVersion('one', shared, async () => first)
    const second = await writtenFor('Two', shared)
    await adapter.putDocumentVersion('two', shared, async () => second)

    await adapter.deleteDocument('one')
    const result = await adapter.collectGarbage?.(NOW_OLD)

    // One's manifests are unreferenced and old; the shared body is not.
    expect(result?.deletedManifests).toBe(1)
    expect(result?.deletedBodies).toBe(0)
    expect(mock.objects.has(bodyKey(first.bodyId ?? ''))).toBe(true)
    expect(await adapter.getDocument('two')).toEqual(shared)
  })

  test('a young orphan manifest protects its body from collection', async () => {
    const mock = installMemoryS3(CONFIG)
    seedOrphan(mock, 'sha256:slowcommit', 'sha256:slowbody')
    // The body aged out, but the manifest is young: a commit may be in flight.
    mock.setLastModified(versionManifestKey('sha256:slowcommit'), YOUNG_ISO)

    const result = await adapter.collectGarbage?.(NOW_OLD)

    expect(result?.deletedBodies).toBe(0)
    expect(result?.deletedManifests).toBe(0)
    expect(mock.objects.has(bodyKey('sha256:slowbody'))).toBe(true)
  })
})
