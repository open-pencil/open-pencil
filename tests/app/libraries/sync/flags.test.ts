import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'
import { until } from '@vueuse/core'

import { materializeLibraryAsset } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'
import { sleep } from '@open-pencil/std/timing'

import { createEditorStore } from '@/app/editor/session'
import { writeStoragePreference } from '@/app/integrations/storage/preferences'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'
import {
  kickLibrarySync,
  libraryResolutionKey,
  librarySyncDiagnostics,
  librarySyncRemote,
  librarySyncResolution,
  registerNeedsProvider,
  resetLibrarySyncForTests,
  resumeLibrarySync,
  startLibrarySync,
  whenLibrarySyncIdle
} from '@/app/libraries/sync'

import {
  cleanupLibrarySyncTest,
  configureStorageFixture,
  flush,
  MemoryObjects,
  seedLibrary,
  trackMirror,
  useObjects
} from '#tests/helpers/libraries/sync-fixture'

let objects: MemoryObjects
const mirrorsToDelete: string[] = []

beforeEach(() => {
  objects = new MemoryObjects()
  configureStorageFixture()
})

afterEach(async () => {
  await cleanupLibrarySyncTest(mirrorsToDelete)
})

function track() {
  return trackMirror(mirrorsToDelete)
}

describe('library sync flag intent', () => {
  test('flag intent armed during backoff still runs on the retry pass', async () => {
    const [first, second] = await seedLibrary(objects, 'design-system', 2)
    await useObjects(objects)
    const document = new SceneGraph()
    const revision = await new StorageLibraryCatalog(objects).getRevision('design-system', first)
    materializeLibraryAsset(document, revision, 'button')
    document.enabledLibraries.set('design-system', {
      libraryId: 'design-system',
      revisionId: second,
      enabled: true
    })
    const editor = createEditorStore(document)
    registerNeedsProvider(editor)
    objects.listFailure = new Error('flaky')
    startLibrarySync()
    const remote = await track()
    await flush()
    await whenLibrarySyncIdle()
    expect(librarySyncDiagnostics().attempts).toBe(1)

    // The flag kick arrives while the pump waits out its backoff: it must requeue, not drop.
    objects.listFailure = null
    await kickLibrarySync({ probe: false, includeInstanceRevs: true })
    await whenLibrarySyncIdle()
    for (let waited = 0; waited < 10_000; waited += 100) {
      if (await remote.mirror.hasRevision('design-system', first)) break
      await sleep(100)
    }
    expect(await remote.mirror.hasRevision('design-system', first)).toBe(true)
    // Keep the provider alive through the backoff: needs come from live stores only.
    expect(editor.graph.enabledLibraries.has('design-system')).toBe(true)
  }, 15_000)

  test('flag intent survives a remote rebuild', async () => {
    const [first, second] = await seedLibrary(objects, 'design-system', 2)
    await useObjects(objects)
    const document = new SceneGraph()
    const revision = await new StorageLibraryCatalog(objects).getRevision('design-system', first)
    materializeLibraryAsset(document, revision, 'button')
    document.enabledLibraries.set('design-system', {
      libraryId: 'design-system',
      revisionId: second,
      enabled: true
    })
    const editor = createEditorStore(document)
    registerNeedsProvider(editor)
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()
    await kickLibrarySync({ probe: false, includeInstanceRevs: true })
    await whenLibrarySyncIdle()

    const previous = librarySyncRemote.value
    writeStoragePreference('s3-compatible', 'bucket', 'other-bucket')
    const rebuilt = await until(
      () => librarySyncRemote.value !== null && librarySyncRemote.value !== previous
    ).toBe(true)
    expect(rebuilt).toBe(true)
    await track()
    await flush()
    await whenLibrarySyncIdle()

    const current = librarySyncRemote.value
    if (!current) throw new Error('Library sync remote did not come back')
    // The rebuilt remote's first pass pulls the instance revision without another kick.
    expect(await current.mirror.hasRevision('design-system', first)).toBe(true)
    // Keep the provider alive through the rebuild: needs come from live stores only.
    expect(editor.graph.enabledLibraries.has('design-system')).toBe(true)
  })

  test('an object store that vanishes settles syncing rows as failed', async () => {
    await seedLibrary(objects, 'design-system', 1)
    let store: MemoryObjects | null = objects
    await resetLibrarySyncForTests({
      objects: async () => store,
      remoteDebounceMs: 0
    })
    const editor = createEditorStore(new SceneGraph())
    editor.updateEnabledLibraries((bindings) =>
      bindings.set('design-system', {
        libraryId: 'design-system',
        revisionId: 'ghost-revision',
        enabled: true
      })
    )
    registerNeedsProvider(editor)
    // A transient fetch failure leaves the revision syncing while the backoff retries.
    objects.getFailure = new Error('flaky')
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    const key = libraryResolutionKey('design-system', 'ghost-revision')
    expect(librarySyncResolution.value.get(key)).toBe('syncing')

    // Credentials went missing mid-wait: the row settles as failed, not syncing forever.
    store = null
    objects.getFailure = null
    await resumeLibrarySync()
    await whenLibrarySyncIdle()
    expect(librarySyncResolution.value.get(key)).toBe('failed')
  })

  test('a disabled library contributes its latest revision to instance-rev pulls', async () => {
    const [first, second] = await seedLibrary(objects, 'design-system', 2)
    await useObjects(objects)
    const document = new SceneGraph()
    const revision = await new StorageLibraryCatalog(objects).getRevision('design-system', first)
    materializeLibraryAsset(document, revision, 'button')
    document.enabledLibraries.set('design-system', {
      libraryId: 'design-system',
      revisionId: second,
      enabled: false
    })
    const editor = createEditorStore(document)
    registerNeedsProvider(editor)
    startLibrarySync()
    const remote = await track()
    await flush()
    await whenLibrarySyncIdle()

    await kickLibrarySync({ probe: false, includeInstanceRevs: true })
    await whenLibrarySyncIdle()

    // Update review diffs the instance against the library's latest even disabled.
    expect(await remote.mirror.hasRevision('design-system', first)).toBe(true)
    expect(await remote.mirror.hasRevision('design-system', second)).toBe(true)
    // Keep the provider alive through the pull: needs come from live stores only.
    expect(editor.graph.enabledLibraries.has('design-system')).toBe(true)
  })
})
