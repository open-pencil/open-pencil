import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { bodyKey, versionManifestKey } from '@/app/integrations/storage/namespace'
import { createS3StorageAdapterWithConfig } from '@/app/integrations/storage/s3/adapter'
import {
  serializeVersionManifest,
  VERSION_MANIFEST_SCHEMA
} from '@/app/integrations/storage/versioned/manifest'
import { clearVersionManifestCache } from '@/app/integrations/storage/versioned/manifest-cache'

import { writtenFor } from '#tests/helpers/storage/documents'
import { MEMORY_S3_CONFIG, installMemoryS3, type MemoryS3 } from '#tests/helpers/storage/memory-s3'

// Objects default to 2026-08-04T00:00; a sweep two days later sees them as old, and an object
// stamped an hour before the sweep as young.
const NOW = Date.parse('2026-08-06T00:00:00.000Z')
const YOUNG = '2026-08-05T23:00:00.000Z'

const adapter = createS3StorageAdapterWithConfig(async () => MEMORY_S3_CONFIG)
let bucket: MemoryS3

beforeEach(() => {
  clearVersionManifestCache()
  bucket = installMemoryS3()
})

afterEach(() => {
  bucket.restore()
})

function seedOrphan(stateId: string, bodyId: string): void {
  bucket.seed(
    versionManifestKey(stateId),
    serializeVersionManifest({
      schema: VERSION_MANIFEST_SCHEMA,
      bodyId,
      metadata: {
        name: 'orphan',
        updatedAt: '2026-08-04T00:00:00.000Z',
        sourceFormat: 'fig',
        trashedAt: null
      }
    })
  )
  bucket.seed(bodyKey(bodyId), 'orphan body')
}

describe('versioned garbage collection', () => {
  test('old unreferenced bodies and manifests go; retained ones stay', async () => {
    const bytes = new TextEncoder().encode('retained bytes')
    await adapter.putDocumentVersion('doc', bytes, async () => writtenFor('Kept', bytes))
    seedOrphan('sha256:orphan-state', 'sha256:orphan-body')

    const result = await adapter.collectGarbage?.(NOW)

    expect(result).toEqual({ deletedBodies: 1, deletedManifests: 1 })
    expect(bucket.objects.has(bodyKey('sha256:orphan-body'))).toBe(false)
    expect(await adapter.getDocument('doc')).toEqual(bytes)
  })

  test('young orphans are never touched', async () => {
    seedOrphan('sha256:orphan-state', 'sha256:orphan-body')
    bucket.setLastModified(versionManifestKey('sha256:orphan-state'), YOUNG)
    bucket.setLastModified(bodyKey('sha256:orphan-body'), YOUNG)

    expect(await adapter.collectGarbage?.(NOW)).toEqual({ deletedBodies: 0, deletedManifests: 0 })
  })

  test('a body another document references survives a delete', async () => {
    const shared = new TextEncoder().encode('identical bytes')
    const first = await writtenFor('One', shared)
    await adapter.putDocumentVersion('one', shared, async () => first)
    await adapter.putDocumentVersion('two', shared, async () => writtenFor('Two', shared))

    await adapter.deleteDocument('one')
    const result = await adapter.collectGarbage?.(NOW)

    expect(result).toEqual({ deletedBodies: 0, deletedManifests: 1 })
    expect(bucket.objects.has(bodyKey(first.bodyId ?? ''))).toBe(true)
  })

  test('a young orphan manifest protects its body', async () => {
    seedOrphan('sha256:slow-commit', 'sha256:slow-body')
    bucket.setLastModified(versionManifestKey('sha256:slow-commit'), YOUNG)

    expect(await adapter.collectGarbage?.(NOW)).toEqual({ deletedBodies: 0, deletedManifests: 0 })
    expect(bucket.objects.has(bodyKey('sha256:slow-body'))).toBe(true)
  })
})
