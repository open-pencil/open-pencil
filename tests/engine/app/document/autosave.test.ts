import { describe, expect, test, vi } from 'bun:test'

import { promiseTimeout } from '@vueuse/core'
import { reactive } from 'vue'

import { createAutosave } from '@/app/document/autosave'

function createHarness() {
  const state = reactive({ sceneVersion: 0, autosaveEnabled: true })
  let savedVersion = 0
  const saveCurrentDocument = vi.fn(async () => {
    savedVersion = state.sceneVersion
  })
  const autosave = createAutosave({
    state,
    getSavedVersion: () => savedVersion,
    hasWritableSource: () => true,
    saveCurrentDocument
  })
  return { state, saveCurrentDocument, ...autosave }
}

describe('autosave flush', () => {
  test('saves pending edits immediately without waiting out the debounce', async () => {
    const { state, saveCurrentDocument, flushAutosave, disposeAutosave } = createHarness()
    state.sceneVersion = 1

    await flushAutosave()

    expect(saveCurrentDocument).toHaveBeenCalledTimes(1)
    disposeAutosave()
  })

  test('does nothing when the document is not dirty', async () => {
    const { saveCurrentDocument, flushAutosave, disposeAutosave } = createHarness()

    await flushAutosave()

    expect(saveCurrentDocument).not.toHaveBeenCalled()
    disposeAutosave()
  })

  test('respects a disabled autosave', async () => {
    const { state, saveCurrentDocument, flushAutosave, disposeAutosave } = createHarness()
    state.autosaveEnabled = false
    state.sceneVersion = 2

    await flushAutosave()

    expect(saveCurrentDocument).not.toHaveBeenCalled()
    disposeAutosave()
  })

  test('a flush marks the document clean, so the debounced save does not double-fire', async () => {
    const { state, saveCurrentDocument, flushAutosave, disposeAutosave } = createHarness()
    state.sceneVersion = 1

    await flushAutosave()
    // Let the debounced watcher (3s) fire while the process is still alive.
    await promiseTimeout(3200)

    expect(saveCurrentDocument).toHaveBeenCalledTimes(1)
    disposeAutosave()
  })
})
