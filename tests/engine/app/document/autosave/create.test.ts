import { describe, expect, jest, test } from 'bun:test'

import { nextTick, reactive, ref } from 'vue'

import { createAutosave } from '@/app/document/autosave/create'

function deferred() {
  let resolve: (() => void) | null = null
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve: () => resolve?.() }
}

function setup(saveCurrentDocument: (version: number) => Promise<void>) {
  const state = reactive({ autosaveEnabled: true, roomKeepsEdits: false })
  const version = ref(0)
  let savedVersion = 0
  let writable = true
  const autosave = createAutosave({
    state,
    version: () => version.value,
    getSavedVersion: () => savedVersion,
    hasWritableSource: () => writable,
    saveCurrentDocument: async (version) => {
      await saveCurrentDocument(version)
      savedVersion = version
    }
  })
  return {
    state,
    version,
    autosave,
    setWritable: (value: boolean) => {
      writable = value
    }
  }
}

describe('document autosave', () => {
  test('skips saved versions and documents without writable sources', async () => {
    const versions: number[] = []
    const { version, autosave, setWritable } = setup(async (saved) => {
      versions.push(saved)
    })

    await autosave.requestSave(0)
    setWritable(false)
    version.value = 1
    await autosave.requestSave(1)
    expect(versions).toEqual([])

    setWritable(true)
    await autosave.requestSave(1)
    version.value = 0
    await autosave.requestSave(0)
    await autosave.requestSave(1)
    expect(versions).toEqual([1])
    autosave.disposeAutosave()
  })

  test('coalesces 100 edits during an in-flight save into the latest version', async () => {
    const firstSave = deferred()
    const started: number[] = []
    const { version, autosave } = setup(async (saved) => {
      started.push(saved)
      if (started.length === 1) await firstSave.promise
    })

    version.value = 1
    const pending = autosave.requestSave(1)
    await Promise.resolve()
    for (let next = 2; next <= 101; next++) {
      version.value = next
      void autosave.requestSave(next)
    }
    firstSave.resolve()
    await pending

    expect(started).toEqual([1, 101])
    autosave.disposeAutosave()
  })

  test('retries the current version after a failed save', async () => {
    let attempts = 0
    const { version, autosave } = setup(async () => {
      attempts++
      if (attempts === 1) throw new Error('write failed')
    })
    version.value = 1

    await expect(autosave.requestSave(1)).rejects.toThrow('write failed')
    await autosave.requestSave(1)

    expect(attempts).toBe(2)
    autosave.disposeAutosave()
  })

  test('preserves a newer requested version when the active save fails', async () => {
    const firstSave = deferred()
    const started: number[] = []
    const { version, autosave } = setup(async (saved) => {
      started.push(saved)
      if (saved === 1) {
        await firstSave.promise
        throw new Error('write failed')
      }
    })

    version.value = 1
    const failed = autosave.requestSave(1)
    await Promise.resolve()
    version.value = 2
    void autosave.requestSave(2)
    firstSave.resolve()
    await expect(failed).rejects.toThrow('write failed')
    await Promise.resolve()

    expect(started).toEqual([1, 2])
    autosave.disposeAutosave()
  })

  test('saves shortly after editing stops, or within a minute while it goes on', async () => {
    jest.useFakeTimers()
    try {
      const versions: number[] = []
      const { version, autosave } = setup(async (saved) => {
        versions.push(saved)
      })
      version.value = 1
      await nextTick()
      jest.advanceTimersByTime(3_000)
      await Promise.resolve()
      expect(versions).toEqual([1])

      // An edit every two seconds never leaves a three-second pause.
      for (let next = 2; next <= 31; next++) {
        version.value = next
        await nextTick()
        jest.advanceTimersByTime(2_000)
        await Promise.resolve()
      }
      // A minute after the first unsaved edit, the 31st, made two seconds earlier, is saved.
      expect(versions).toEqual([1, 31])
      autosave.disposeAutosave()
    } finally {
      jest.useRealTimers()
    }
  })

  test('saves a checkpoint a minute after the last edit while the room keeps the edits', async () => {
    jest.useFakeTimers()
    try {
      const versions: number[] = []
      const { state, version, autosave } = setup(async (saved) => {
        versions.push(saved)
      })
      state.roomKeepsEdits = true
      version.value = 1
      await nextTick()
      jest.advanceTimersByTime(59_000)
      await Promise.resolve()
      expect(versions).toEqual([])
      jest.advanceTimersByTime(1_000)
      await Promise.resolve()
      expect(versions).toEqual([1])
      autosave.disposeAutosave()
    } finally {
      jest.useRealTimers()
    }
  })

  test('saves at once when the room stops keeping the edits', async () => {
    jest.useFakeTimers()
    try {
      const versions: number[] = []
      const { state, version, autosave } = setup(async (saved) => {
        versions.push(saved)
      })
      state.roomKeepsEdits = true
      version.value = 1
      await nextTick()
      jest.advanceTimersByTime(5_000)
      await Promise.resolve()
      expect(versions).toEqual([])
      state.roomKeepsEdits = false
      await nextTick()
      await Promise.resolve()
      expect(versions).toEqual([1])
      autosave.disposeAutosave()
    } finally {
      jest.useRealTimers()
    }
  })
})
