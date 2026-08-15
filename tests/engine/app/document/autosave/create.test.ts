import { describe, expect, test } from 'bun:test'

import { reactive } from 'vue'

import { createDefaultEditorState } from '@open-pencil/core/editor'

import { createAutosave } from '@/app/document/autosave/create'

function deferred() {
  let resolve: (() => void) | null = null
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve: () => resolve?.() }
}

function setup(saveCurrentDocument: (version: number) => Promise<void>) {
  const state = reactive({
    ...createDefaultEditorState('page-1'),
    autosaveEnabled: true
  })
  let savedVersion = 0
  let writable = true
  const autosave = createAutosave({
    state,
    getSavedVersion: () => savedVersion,
    hasWritableSource: () => writable,
    saveCurrentDocument: async (version) => {
      await saveCurrentDocument(version)
      savedVersion = version
    }
  })
  return {
    state,
    autosave,
    setWritable: (value: boolean) => {
      writable = value
    }
  }
}

describe('document autosave', () => {
  test('skips saved versions and documents without writable sources', async () => {
    const versions: number[] = []
    const { state, autosave, setWritable } = setup(async (version) => {
      versions.push(version)
    })

    await autosave.requestSave(0)
    setWritable(false)
    state.sceneVersion = 1
    await autosave.requestSave(1)
    expect(versions).toEqual([])

    setWritable(true)
    await autosave.requestSave(1)
    state.sceneVersion = 0
    await autosave.requestSave(0)
    await autosave.requestSave(1)
    expect(versions).toEqual([1])
    autosave.disposeAutosave()
  })

  test('coalesces 100 edits during an in-flight save into the latest version', async () => {
    const firstSave = deferred()
    const started: number[] = []
    const { state, autosave } = setup(async (version) => {
      started.push(version)
      if (started.length === 1) await firstSave.promise
    })

    state.sceneVersion = 1
    const pending = autosave.requestSave(1)
    await Promise.resolve()
    for (let version = 2; version <= 101; version++) {
      state.sceneVersion = version
      void autosave.requestSave(version)
    }
    firstSave.resolve()
    await pending

    expect(started).toEqual([1, 101])
    autosave.disposeAutosave()
  })

  test('retries the current version after a failed save', async () => {
    let attempts = 0
    const { state, autosave } = setup(async () => {
      attempts++
      if (attempts === 1) throw new Error('write failed')
    })
    state.sceneVersion = 1

    await expect(autosave.requestSave(1)).rejects.toThrow('write failed')
    await autosave.requestSave(1)

    expect(attempts).toBe(2)
    autosave.disposeAutosave()
  })

  test('preserves a newer requested version when the active save fails', async () => {
    const firstSave = deferred()
    const started: number[] = []
    const { state, autosave } = setup(async (version) => {
      started.push(version)
      if (version === 1) {
        await firstSave.promise
        throw new Error('write failed')
      }
    })

    state.sceneVersion = 1
    const failed = autosave.requestSave(1)
    await Promise.resolve()
    state.sceneVersion = 2
    void autosave.requestSave(2)
    firstSave.resolve()
    await expect(failed).rejects.toThrow('write failed')
    await Promise.resolve()

    expect(started).toEqual([1, 2])
    autosave.disposeAutosave()
  })
})
