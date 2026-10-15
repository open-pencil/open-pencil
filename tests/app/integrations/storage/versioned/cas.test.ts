import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { StorageConflictError } from '@/app/integrations/storage/conflict'
import { documentHeadKey } from '@/app/integrations/storage/namespace'
import { createS3StorageAdapterWithConfig } from '@/app/integrations/storage/s3/adapter'
import { clearVersionManifestCache } from '@/app/integrations/storage/versioned/manifest-cache'

import { writtenFor } from '#tests/helpers/storage/documents'
import { MEMORY_S3_CONFIG, installMemoryS3, type MemoryS3 } from '#tests/helpers/storage/memory-s3'

const BODY = new TextEncoder().encode('cas body')
let bucket: MemoryS3

beforeEach(() => {
  clearVersionManifestCache()
  bucket = installMemoryS3()
})

afterEach(() => {
  bucket.restore()
})

function headIfMatches(id: string): (string | null)[] {
  return bucket.requests
    .filter((request) => request.method === 'PUT' && request.key === documentHeadKey(id))
    .map((request) => request.ifMatch)
}

describe('conditional head updates', () => {
  test('a conditional adapter sends If-Match; the generic S3 adapter never does', async () => {
    const conditional = createS3StorageAdapterWithConfig(async () => MEMORY_S3_CONFIG, {
      conditionalHeadUpdates: true
    })
    await conditional.putDocumentVersion('doc', BODY, async () => writtenFor('V1', BODY))
    await conditional.putMetadataVersion('doc', await writtenFor('V2', BODY))
    const sent = headIfMatches('doc')
    expect(sent).toHaveLength(2)
    expect(sent[0]).toBeNull()
    expect(sent[1]).not.toBeNull()

    const plain = createS3StorageAdapterWithConfig(async () => MEMORY_S3_CONFIG)
    await plain.putDocumentVersion('plain', BODY, async () => writtenFor('P1', BODY))
    await plain.putMetadataVersion('plain', await writtenFor('P2', BODY))
    expect(headIfMatches('plain')).toEqual([null, null])
  })

  test('weak validators are never sent, so a commit cannot conflict with itself', async () => {
    bucket.restore()
    bucket = installMemoryS3(MEMORY_S3_CONFIG, { weakEtags: true })
    const conditional = createS3StorageAdapterWithConfig(async () => MEMORY_S3_CONFIG, {
      conditionalHeadUpdates: true
    })
    await conditional.putDocumentVersion('doc', BODY, async () => writtenFor('V1', BODY))
    await conditional.putMetadataVersion('doc', await writtenFor('V2', BODY))

    expect(headIfMatches('doc')).toEqual([null, null])
    expect((await conditional.getDocumentMetadata?.('doc'))?.name).toBe('V2')
  })

  test('a metadata commit over a deleted design conflicts instead of bringing it back', async () => {
    const adapter = createS3StorageAdapterWithConfig(async () => MEMORY_S3_CONFIG)
    const first = await adapter.putDocumentVersion('gone', BODY, async () => writtenFor('V1', BODY))
    await adapter.deleteDocument('gone')

    await expect(
      adapter.putMetadataVersion('gone', await writtenFor('Renamed', BODY), {
        expectedBase: { baseStateId: first.stateId, lastPublishedStateId: first.stateId }
      })
    ).rejects.toBeInstanceOf(StorageConflictError)
    // Only the first commit ever wrote the head.
    expect(headIfMatches('gone')).toHaveLength(1)
  })

  test('a lost race surfaces as a conflict and leaves the head untouched', async () => {
    const conditional = createS3StorageAdapterWithConfig(async () => MEMORY_S3_CONFIG, {
      conditionalHeadUpdates: true
    })
    await conditional.putDocumentVersion('doc', BODY, async () => writtenFor('V1', BODY))
    const before = bucket.objects.get(documentHeadKey('doc'))
    bucket.failOnce(documentHeadKey('doc'), 412)

    await expect(
      conditional.putMetadataVersion('doc', await writtenFor('V2', BODY))
    ).rejects.toBeInstanceOf(StorageConflictError)
    expect(bucket.objects.get(documentHeadKey('doc'))).toEqual(before)
  })
})
