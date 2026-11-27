import 'fake-indexeddb/auto'
import { afterEach, describe, expect, jest, spyOn, test } from 'bun:test'

import { nextTick } from 'vue'

import { SceneGraph } from '@open-pencil/scene-graph'
import { createDeferred } from '@open-pencil/std/async'

import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import { resetLibraryServiceForTests, useLibraryService } from '@/app/libraries/host'
import { writeLibraryCatalogSource } from '@/app/libraries/preferences'
import { LibraryService } from '@/app/libraries/service'
import { librarySyncRemote, librarySyncResolution } from '@/app/libraries/sync/status'
import type { LibrarySyncRemote } from '@/app/libraries/sync/status'

/**
 * Arms the singleton's debounced resolution refresh: a resolution row change, then a tick for
 * the watch flush that starts the debounce timer.
 */
async function armResolutionRefresh() {
  librarySyncResolution.value = new Map([['library\0revision', 'syncing']])
  await nextTick()
}

/** The remote view the engine publishes: a mirror plus the catalog wrapping it. */
function remoteView(mirror: LocalLibraryCatalog, name: string): LibrarySyncRemote {
  return {
    mirror,
    catalog: new MirroredLibraryCatalog(
      new LocalLibraryCatalog(`local-${name}-${crypto.randomUUID()}`),
      async () => null,
      mirror
    ),
    dbName: name
  }
}

/** A storage-source remote whose mirror lists one library named `libraryId`. */
async function seededRemote(name: string, libraryId: string): Promise<LibrarySyncRemote> {
  const mirror = new LocalLibraryCatalog(`mirror-${name}-${crypto.randomUUID()}`)
  await mirror.cacheSummary({
    libraryId,
    name: `Library ${libraryId}`,
    latestRevisionId: `${libraryId}-rev`,
    publishedAt: '2026-01-01T00:00:00.000Z',
    assetCount: 1
  })
  return remoteView(mirror, name)
}

afterEach(() => {
  resetLibraryServiceForTests()
  librarySyncRemote.value = null
  librarySyncResolution.value = new Map()
  writeLibraryCatalogSource('local')
  jest.useRealTimers()
})

describe('library service host', () => {
  test('a resolution settle refreshes the active editor after the debounce', async () => {
    jest.useFakeTimers()
    const refresh = spyOn(LibraryService.prototype, 'refresh').mockImplementation(
      async () => undefined
    )
    try {
      useLibraryService()
      setActiveEditorStore(createEditorStore(new SceneGraph()))

      await armResolutionRefresh()
      jest.advanceTimersByTime(10_000)

      expect(refresh).toHaveBeenCalledTimes(1)
    } finally {
      refresh.mockRestore()
    }
  })

  test('a service reset inside the debounce window disarms the pending refresh', async () => {
    jest.useFakeTimers()
    const refresh = spyOn(LibraryService.prototype, 'refresh').mockImplementation(
      async () => undefined
    )
    try {
      useLibraryService()
      setActiveEditorStore(createEditorStore(new SceneGraph()))

      await armResolutionRefresh()
      // VueUse does not cancel an armed debounce timer when the watch is stopped, so the
      // timer still fires after the teardown; the guard is what must make it a no-op.
      resetLibraryServiceForTests()
      jest.advanceTimersByTime(10_000)

      expect(refresh).not.toHaveBeenCalled()
    } finally {
      refresh.mockRestore()
    }
  })

  test('a refresh armed before a reset never lands on the next service', async () => {
    jest.useFakeTimers()
    const refresh = spyOn(LibraryService.prototype, 'refresh').mockImplementation(
      async () => undefined
    )
    try {
      useLibraryService()
      setActiveEditorStore(createEditorStore(new SceneGraph()))

      await armResolutionRefresh()
      resetLibraryServiceForTests()
      // A new singleton comes up before the stale timer fires.
      useLibraryService()
      jest.advanceTimersByTime(10_000)

      expect(refresh).not.toHaveBeenCalled()
    } finally {
      refresh.mockRestore()
    }
  })

  test('a refresh started on a replaced remote cannot publish its summaries', async () => {
    writeLibraryCatalogSource('storage')
    const service = useLibraryService()
    const remoteA = await seededRemote('remote-a', 'alpha')
    librarySyncRemote.value = remoteA
    await nextTick()

    // The refresh's summary read holds on the old mirror while the engine publishes
    // the next remote; landing afterward, it must not write mirror A's rows.
    const gate = createDeferred<undefined>()
    const listLibrariesA = remoteA.mirror.listLibraries.bind(remoteA.mirror)
    remoteA.mirror.listLibraries = async () => {
      await gate.promise
      return listLibrariesA()
    }
    const editor = createEditorStore(new SceneGraph())
    const pending = service.refresh(editor)

    const remoteB = await seededRemote('remote-b', 'beta')
    librarySyncRemote.value = remoteB
    await nextTick()
    gate.resolve(undefined)
    await pending

    expect(service.summaries.value.map((row) => row.libraryId)).toEqual([])
    expect((await service.listLibraries()).map((row) => row.libraryId)).toEqual(['beta'])

    await remoteA.mirror.close()
    await remoteB.mirror.close()
  })

  test('a listLibraries call started on a replaced remote does not write the summaries', async () => {
    writeLibraryCatalogSource('storage')
    const service = useLibraryService()
    const remoteA = await seededRemote('remote-a', 'alpha')
    librarySyncRemote.value = remoteA
    await nextTick()

    const gate = createDeferred<undefined>()
    const listLibrariesA = remoteA.mirror.listLibraries.bind(remoteA.mirror)
    remoteA.mirror.listLibraries = async () => {
      await gate.promise
      return listLibrariesA()
    }
    const pending = service.listLibraries()

    const remoteB = await seededRemote('remote-b', 'beta')
    librarySyncRemote.value = remoteB
    await nextTick()
    gate.resolve(undefined)

    // The caller still gets the rows its own read returned…
    await expect(pending).resolves.toMatchObject([{ libraryId: 'alpha' }])
    // …but they belong to the retired mirror, so the service state stays empty.
    expect(service.summaries.value.map((row) => row.libraryId)).toEqual([])
    expect((await service.listLibraries()).map((row) => row.libraryId)).toEqual(['beta'])

    await remoteA.mirror.close()
    await remoteB.mirror.close()
  })
})
