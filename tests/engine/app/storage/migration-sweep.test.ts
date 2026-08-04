import { afterEach, describe, expect, test } from 'bun:test'

import { bodyKey, documentHeadKey } from '@/app/integrations/storage/namespace'
import { createS3StorageAdapterWithConfig } from '@/app/integrations/storage/s3/adapter'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'
import { computeBodyIdSafe } from '@/app/storage/identity/body'

import { installMemoryS3 } from '#tests/helpers/memory-s3'

import { createHarness, type RecordingAdapter } from './sync/harness'

const CONFIG: S3CompatibleConfig = {
  endpoint: 'https://s3.example.test',
  bucket: 'bucket-1',
  accessKeyId: 'key-id',
  secretAccessKey: 'secret'
}

const TARGET = 's3-compatible#00000000'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

async function seedLegacyConfirmed(
  store: ReturnType<typeof createHarness>['store'],
  id: string,
  bytes: Uint8Array
): Promise<string> {
  const bodyId = await computeBodyIdSafe(bytes, 'fig')
  await store.writeCanvas({
    id,
    syncTargetId: TARGET,
    name: id,
    sourceFormat: 'fig',
    figBytes: bytes,
    bodyId
  })
  // A confirmation earned under the FIXED-KEY layout, as every pre-migration
  // row carries: synced, but never versioned-confirmed.
  await store.updateMeta(id, { syncStatus: 'synced', syncedBodyId: bodyId })
  return bodyId
}

describe('layout migration sweep', () => {
  test('a proof whose body exists under bodies/ is re-confirmed', async () => {
    const mock = installMemoryS3(CONFIG)
    const adapter = createS3StorageAdapterWithConfig(async () => CONFIG)
    const harness = createHarness({ adapter: adapter as RecordingAdapter })
    const bytes = new TextEncoder().encode('legacy bytes')
    const bodyId = await seedLegacyConfirmed(harness.store, 'doc', bytes)
    mock.objects.set(bodyKey(bodyId), bytes)

    await harness.engine.pumpOnce()

    const meta = await harness.store.getMeta('doc')
    expect(meta?.versionedConfirmed).toBe(true)
    expect(meta?.syncedBodyId).toBe(bodyId)
    expect(meta?.syncStatus).toBe('synced')
  })

  test('a stale proof is cleared and the body re-uploads through the versioned commit', async () => {
    const mock = installMemoryS3(CONFIG)
    const adapter = createS3StorageAdapterWithConfig(async () => CONFIG)
    const harness = createHarness({ adapter: adapter as RecordingAdapter })
    const bytes = new TextEncoder().encode('legacy bytes')
    const bodyId = await seedLegacyConfirmed(harness.store, 'doc', bytes)
    // No bodies/{bodyId} object: the fixed-key proof describes nothing here.

    await harness.engine.pumpOnce()
    await harness.drainWakes()

    const meta = await harness.store.getMeta('doc')
    expect(meta?.syncStatus).toBe('synced')
    expect(meta?.versionedConfirmed).toBe(true)
    expect(meta?.syncedBodyId).toBe(bodyId)
    // The conservative re-upload published the versioned layout.
    expect(mock.objects.has(bodyKey(bodyId))).toBe(true)
    expect(mock.objects.has(documentHeadKey('doc'))).toBe(true)
  })

  test('rows without a confirmation are left alone', async () => {
    installMemoryS3(CONFIG)
    const adapter = createS3StorageAdapterWithConfig(async () => CONFIG)
    const harness = createHarness({ adapter: adapter as RecordingAdapter })
    const bytes = new TextEncoder().encode('fresh bytes')
    const bodyId = await computeBodyIdSafe(bytes, 'fig')
    await harness.store.writeCanvas({
      id: 'doc',
      syncTargetId: TARGET,
      name: 'doc',
      sourceFormat: 'fig',
      figBytes: bytes,
      bodyId
    })

    await harness.engine.pumpOnce()

    const meta = await harness.store.getMeta('doc')
    expect(meta?.versionedConfirmed ?? false).toBe(false)
    expect(meta?.syncedBodyId).toBeNull()
  })

  test('adapters without a versioned layout keep their fixed-key proofs', async () => {
    const harness = createHarness() // recordingAdapter: no hasRemoteBody
    const bytes = new TextEncoder().encode('appwrite-shaped bytes')
    const bodyId = await seedLegacyConfirmed(harness.store, 'doc', bytes)

    await harness.engine.pumpOnce()

    const meta = await harness.store.getMeta('doc')
    expect(meta?.syncedBodyId).toBe(bodyId)
    expect(meta?.versionedConfirmed ?? false).toBe(false)
    expect(meta?.syncStatus).toBe('synced')
  })
})
