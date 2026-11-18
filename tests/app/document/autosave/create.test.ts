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

function setup(
  saveCurrentDocument: (version: number) => Promise<void>,
  report: { onFailed?: (error: unknown) => void; onSaved?: () => void } = {}
) {
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
    },
    ...report
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

  test('reports an edit’s failed save, then the retry that saves it', async () => {
    jest.useFakeTimers()
    try {
      const events: string[] = []
      let fail = true
      const { version, autosave } = setup(
        async (saved) => {
          if (fail) throw new Error(`write ${saved} failed`)
        },
        {
          onFailed: (error) => events.push(error instanceof Error ? error.message : 'unknown'),
          onSaved: () => events.push('saved')
        }
      )
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      version.value = 1
      await nextTick()
      jest.advanceTimersByTime(3_000)
      await Promise.resolve()
      await Promise.resolve()
      expect(events).toEqual(['write 1 failed'])

      fail = false
      version.value = 2
      autosave.retry()
      await Promise.resolve()
      await Promise.resolve()
      expect(events).toEqual(['write 1 failed', 'saved'])
      warn.mockRestore()
      autosave.disposeAutosave()
    } finally {
      jest.useRealTimers()
    }
  })

  test('reports nothing for a save its caller awaits, or after it is disposed', async () => {
    const failed: unknown[] = []
    const save = deferred()
    const { version, autosave } = setup(
      async () => {
        await save.promise
        throw new Error('write failed')
      },
      { onFailed: (error) => failed.push(error) }
    )
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    version.value = 1
    const awaited = autosave.requestSave(1)
    save.resolve()
    await expect(awaited).rejects.toThrow('write failed')

    autosave.retry()
    autosave.disposeAutosave()
    // The retry's write fails once every pending callback has run.
    await Bun.sleep(0)
    expect(failed).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  test('a retry with nothing left to save reports it saved', async () => {
    const saved: string[] = []
    const { autosave } = setup(async () => undefined, { onSaved: () => saved.push('saved') })
    autosave.retry()
    expect(saved).toEqual(['saved'])
    autosave.disposeAutosave()
  })
})
