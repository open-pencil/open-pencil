import 'fake-indexeddb/auto'
import { afterEach, describe, expect, jest, spyOn, test } from 'bun:test'

import { nextTick } from 'vue'

import { SceneGraph } from '@open-pencil/scene-graph'

import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import { resetLibraryServiceForTests, useLibraryService } from '@/app/libraries/host'
import { LibraryService } from '@/app/libraries/service'
import { librarySyncResolution } from '@/app/libraries/sync/status'

/**
 * Arms the singleton's debounced resolution refresh: a resolution row change, then a tick for
 * the watch flush that starts the debounce timer.
 */
async function armResolutionRefresh() {
  librarySyncResolution.value = new Map([['library\0revision', 'syncing']])
  await nextTick()
}

afterEach(() => {
  resetLibraryServiceForTests()
  librarySyncResolution.value = new Map()
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
})
