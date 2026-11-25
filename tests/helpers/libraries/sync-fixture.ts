import { until } from '@vueuse/core'
import { nextTick } from 'vue'

import { SceneGraph } from '@open-pencil/scene-graph'
import { DEADLINE_MS, withDeadline } from '@open-pencil/std/timing'

import type { LibraryObjectStore } from '@/app/integrations/storage'
import {
  activeStorageProviderID,
  storedPreferences,
  writeStoragePreference
} from '@/app/integrations/storage/preferences'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'
import { resetLibraryServiceForTests } from '@/app/libraries/host'
import { writeLibraryCatalogSource } from '@/app/libraries/preferences'
import { librarySyncRemote, resetLibrarySyncForTests } from '@/app/libraries/sync'
import { deleteAppDatabase } from '@/app/storage/idb'

export class MemoryObjects implements LibraryObjectStore {
  readonly values = new Map<string, Uint8Array>()
  private readonly etags = new Map<string, string>()
  private etagSeq = 0
  getCalls = 0
  listCalls = 0
  putCalls = 0
  listFailure: unknown = null
  getFailure: unknown = null

  async getObject(key: string) {
    this.getCalls += 1
    if (this.getFailure) throw this.getFailure
    return this.values.get(key) ?? null
  }
  async getObjectValue(key: string) {
    this.getCalls += 1
    if (this.getFailure) throw this.getFailure
    const bytes = this.values.get(key) ?? null
    return { bytes, etag: bytes ? (this.etags.get(key) ?? null) : null }
  }
  async putObject(key: string, bytes: Uint8Array) {
    this.putCalls += 1
    this.values.set(key, new Uint8Array(bytes))
    this.etags.set(key, `etag-${++this.etagSeq}`)
  }
  async listObjects(prefix: string) {
    this.listCalls += 1
    if (this.listFailure) throw this.listFailure
    return [...this.values]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, size: value.byteLength, etag: this.etags.get(key) ?? null }))
  }
}

export function libraryGraph(name = 'Button') {
  const graph = new SceneGraph()
  graph.createNode('COMPONENT', graph.getPages()[0].id, { name, componentKey: 'button' })
  return graph
}

/** Publishes `count` revisions of one library straight into the object store. */
export async function seedLibrary(
  objects: MemoryObjects,
  libraryId: string,
  count: number,
  name = `Library ${libraryId}`,
  previousRevisionId: string | null = null
) {
  const catalog = new StorageLibraryCatalog(objects)
  const revisions: string[] = []
  for (let index = 0; index < count; index++) {
    const revision = await catalog.publishRevision({
      libraryId,
      name,
      graph: libraryGraph(`${name} ${index + 1}`),
      previousRevisionId
    })
    previousRevisionId = revision.manifest.revisionId
    revisions.push(previousRevisionId)
  }
  return revisions
}

/** One flush for the debounced remote rebuild and the watches behind it. */
export async function flush() {
  await yieldEventLoop()
  await nextTick()
  await yieldEventLoop()
}

export function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/** The storage preferences every sync test starts from: S3 provider, one configured bucket. */
export function configureStorageFixture(): void {
  writeLibraryCatalogSource('storage')
  activeStorageProviderID.value = 's3-compatible'
  storedPreferences.value = {}
  writeStoragePreference('s3-compatible', 'endpoint', 'https://example.test')
  writeStoragePreference('s3-compatible', 'bucket', 'libraries')
  writeStoragePreference('s3-compatible', 'region', 'auto')
}

/** Substitutes the object store and zeroes the rebuild debounce between tests. */
export async function useObjects(store: MemoryObjects): Promise<void> {
  await resetLibrarySyncForTests({ objects: async () => store, remoteDebounceMs: 0 })
}

/** Waits for the rebuilt remote and records its mirror database for cleanup. */
export async function trackMirror(mirrorsToDelete: string[]) {
  // The remote comes up on local IndexedDB/memory work, so the request tier bounds the
  // wait; on timeout the pending until() keeps polling in the background harmlessly.
  await withDeadline(DEADLINE_MS.request, () => until(librarySyncRemote).toBeTruthy())
  const remote = librarySyncRemote.value
  if (!remote) throw new Error('Library sync remote did not come up')
  if (!mirrorsToDelete.includes(remote.dbName)) mirrorsToDelete.push(remote.dbName)
  return remote
}

/** Resets the engine, the service singleton, preferences, and the mirrors this file created. */
export async function cleanupLibrarySyncTest(mirrorsToDelete: string[]): Promise<void> {
  resetLibraryServiceForTests()
  await resetLibrarySyncForTests()
  writeLibraryCatalogSource('local')
  activeStorageProviderID.value = 's3-compatible'
  storedPreferences.value = {}
  for (const name of mirrorsToDelete.splice(0)) {
    await deleteAppDatabase(name).catch(() => undefined)
  }
}
