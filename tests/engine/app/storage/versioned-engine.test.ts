import { afterEach, describe, expect, test } from 'bun:test'

import { documentHeadKey } from '@/app/integrations/storage/namespace'
import { createS3StorageAdapterWithConfig } from '@/app/integrations/storage/s3/adapter'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'
import { computeBodyIdSafe } from '@/app/storage/identity/body'
import { computeStateIdentity } from '@/app/storage/identity/state'

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

function versionedHarness() {
  const mock = installMemoryS3(CONFIG)
  const adapter = createS3StorageAdapterWithConfig(async () => CONFIG)
  const harness = createHarness({ adapter: adapter as RecordingAdapter })
  return { mock, adapter, ...harness }
}

async function writeLocal(
  store: ReturnType<typeof versionedHarness>['store'],
  id: string,
  bytes: Uint8Array,
  name = id
): Promise<number> {
  // The app's write path always supplies the body identity with the bytes.
  const bodyId = await computeBodyIdSafe(bytes, 'fig')
  await store.writeCanvas({
    id,
    syncTargetId: TARGET,
    name,
    sourceFormat: 'fig',
    figBytes: bytes,
    bodyId
  })
  const meta = await store.getMeta(id)
  return meta?.revision ?? 1
}

describe('sync engine against the versioned layout', () => {
  test('putCanvas commits through the head and confirms the row for the layout', async () => {
    const { mock, adapter, engine, store, drainWakes } = versionedHarness()
    const bytes = new TextEncoder().encode('engine body')
    const revision = await writeLocal(store, 'doc', bytes)

    await engine.enqueuePutCanvas('doc', revision)
    await drainWakes()

    const meta = await store.getMeta('doc')
    expect(meta?.syncStatus).toBe('synced')
    expect(meta?.versionedConfirmed).toBe(true)
    expect(meta?.syncedBodyId).toBe(meta?.bodyId)
    expect(meta?.baseStateId).not.toBeNull()
    // The commit published body, manifest, and head.
    expect(mock.objects.has(documentHeadKey('doc'))).toBe(true)
    expect(await adapter.getDocument('doc')).toEqual(bytes)
  })

  test('a rename after a synced body writes a metadata-only version', async () => {
    const { mock, adapter, engine, store, drainWakes } = versionedHarness()
    const bytes = new TextEncoder().encode('engine body')
    const revision = await writeLocal(store, 'doc', bytes)
    await engine.enqueuePutCanvas('doc', revision)
    await drainWakes()
    const bodyPuts = mock.requests.filter(
      (r) => r.method === 'PUT' && r.key.includes('/bodies/')
    ).length

    const meta = await store.getMeta('doc')
    await store.updateMeta('doc', { name: 'Renamed' })
    await engine.enqueuePutMetadata('doc', meta?.revision ?? 1)
    await drainWakes()

    // No body bytes moved; the head advanced with a new manifest.
    expect(
      mock.requests.filter((r) => r.method === 'PUT' && r.key.includes('/bodies/')).length
    ).toBe(bodyPuts)
    const head = JSON.parse(new TextDecoder().decode(mock.objects.get(documentHeadKey('doc'))))
    expect(head.history).toHaveLength(2)
    expect((await adapter.getDocumentMetadata('doc'))?.name).toBe('Renamed')
    const after = await store.getMeta('doc')
    expect(after?.baseStateId).not.toBe(meta?.baseStateId)
  })

  test('a remote that moved since the base parks the write as a conflict', async () => {
    const { adapter, engine, store, drainWakes } = versionedHarness()
    const bytes = new TextEncoder().encode('engine body')
    const revision = await writeLocal(store, 'doc', bytes)
    await engine.enqueuePutCanvas('doc', revision)
    await drainWakes()
    const base = (await store.getMeta('doc'))?.baseStateId

    // Another device commits a different state.
    const otherBytes = new TextEncoder().encode('other device body')
    const otherBodyId = await computeBodyIdSafe(otherBytes, 'fig')
    const { stateId: otherStateId } = await computeStateIdentity(otherBodyId, {
      name: 'Other',
      sourceFormat: 'fig',
      isTrashed: false
    })
    await adapter.putDocumentVersion('doc', otherBytes, async () => ({
      name: 'Other',
      updatedAt: '2026-08-04T13:00:00.000Z',
      sourceFormat: 'fig',
      trashedAt: null,
      bodyId: otherBodyId,
      stateId: otherStateId
    }))

    // This device renames and tries to publish — preflight must stop it.
    const meta = await store.getMeta('doc')
    await store.updateMeta('doc', { name: 'Mine' })
    await engine.enqueuePutMetadata('doc', meta?.revision ?? 1)
    await drainWakes()

    const after = await store.getMeta('doc')
    expect(after?.syncStatus).toBe('conflict')
    expect(after?.baseStateId).toBe(base)
    // The remote still holds the other device's state, untouched.
    expect((await adapter.getDocumentMetadata('doc'))?.name).toBe('Other')
  })
})
