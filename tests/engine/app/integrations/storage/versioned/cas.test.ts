import { afterEach, describe, expect, test } from 'bun:test'

import { StorageConflictError } from '@/app/integrations/storage/conflict'
import { documentHeadKey } from '@/app/integrations/storage/namespace'
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

const BODY = new TextEncoder().encode('cas body')

describe('conditional head updates (CAS)', () => {
  test('a CAS-enabled adapter sends If-Match; the default adapter never does', async () => {
    const mock = installMemoryS3(CONFIG)
    const conditional = createS3StorageAdapterWithConfig(async () => CONFIG, {
      conditionalHeadUpdates: true
    })
    const first = await writtenFor('V1', BODY)
    await conditional.putDocumentVersion('doc', BODY, async () => first)
    const second = await writtenFor('V2', BODY)
    await conditional.putMetadataVersion('doc', second)

    const headIfMatches = mock.requests
      .filter((request) => request.method === 'PUT' && request.key === documentHeadKey('doc'))
      .map((request) => request.ifMatch)
    // First commit has no previous head to compare; the second must compare.
    expect(headIfMatches).toHaveLength(2)
    expect(headIfMatches[0]).toBeNull()
    expect(headIfMatches[1]).not.toBeNull()

    const plain = createS3StorageAdapterWithConfig(async () => CONFIG)
    const plainWritten = await writtenFor('P1', BODY)
    await plain.putDocumentVersion('plain', BODY, async () => plainWritten)
    const plainIfMatches = mock.requests
      .filter((request) => request.method === 'PUT' && request.key === documentHeadKey('plain'))
      .map((request) => request.ifMatch)
    expect(plainIfMatches).toEqual([null])
  })

  test('weak etags degrade to the non-conditional commit instead of self-conflicting', async () => {
    // R2 answers chunked (string-body) uploads with W/ validators, and
    // If-Match must not match weak ones — the commit must skip CAS, not 412
    // against its own previous write.
    const mock = installMemoryS3(CONFIG, { weakEtags: true })
    const conditional = createS3StorageAdapterWithConfig(async () => CONFIG, {
      conditionalHeadUpdates: true
    })
    const first = await writtenFor('V1', BODY)
    await conditional.putDocumentVersion('doc', BODY, async () => first)
    const second = await writtenFor('V2', BODY)
    await conditional.putMetadataVersion('doc', second)

    const headIfMatches = mock.requests
      .filter((request) => request.method === 'PUT' && request.key === documentHeadKey('doc'))
      .map((request) => request.ifMatch)
    expect(headIfMatches).toEqual([null, null])
    expect((await conditional.getDocumentMetadata('doc'))?.name).toBe('V2')
  })

  test('a lost CAS race surfaces as a typed conflict and leaves the head untouched', async () => {
    const mock = installMemoryS3(CONFIG)
    const conditional = createS3StorageAdapterWithConfig(async () => CONFIG, {
      conditionalHeadUpdates: true
    })
    const first = await writtenFor('V1', BODY)
    await conditional.putDocumentVersion('doc', BODY, async () => first)
    const headBefore = mock.objects.get(documentHeadKey('doc'))

    const second = await writtenFor('V2', BODY)
    mock.failOnce(documentHeadKey('doc'), 412)
    await expect(conditional.putMetadataVersion('doc', second)).rejects.toThrow(
      StorageConflictError
    )

    expect(mock.objects.get(documentHeadKey('doc'))).toEqual(headBefore)
  })
})
