import { afterEach, describe, expect, test } from 'bun:test'

import {
  claimFailureNotice,
  saveWithFeedback,
  showSaveFailure
} from '@/app/document/io/save/feedback'
import { createDeferred } from '@/app/runtime/deferred'
import { toast } from '@/app/shell/ui'

afterEach(() => {
  for (const entry of toast.toasts.value) toast.remove(entry.id)
})

describe('save feedback', () => {
  test('keeps a failed save visible and retries it', async () => {
    let attempts = 0
    const save = async () => {
      attempts += 1
      if (attempts === 1) throw new Error('disk full')
      return true
    }

    await expect(saveWithFeedback(save)).resolves.toBe(false)

    const entry = toast.toasts.value[0]
    expect(entry?.sticky).toBe(true)
    entry?.action?.run(entry.id)
    await Bun.sleep(0)

    expect(attempts).toBe(2)
    expect(toast.toasts.value).toHaveLength(0)
  })

  test('clears a failure once the same document saves', async () => {
    const key = {}
    let fail = true
    const save = async () => {
      if (fail) throw new Error('disk full')
      return true
    }

    await expect(saveWithFeedback(save, { key })).resolves.toBe(false)
    expect(toast.toasts.value).toHaveLength(1)

    fail = false
    // A save of an older revision leaves the newer edits, and their failure, in place.
    let unsaved = true
    const hasUnsavedChanges = () => unsaved
    await expect(saveWithFeedback(save, { key, hasUnsavedChanges })).resolves.toBe(true)
    expect(toast.toasts.value).toHaveLength(1)

    unsaved = false
    await expect(saveWithFeedback(save, { key, hasUnsavedChanges })).resolves.toBe(true)
    expect(toast.toasts.value).toHaveLength(0)
  })

  test('does not retry a document that is no longer open', async () => {
    let attempts = 0
    const key = {}
    const save = async () => {
      attempts += 1
      throw new Error('disk full')
    }

    let open = true
    await expect(saveWithFeedback(save, { key, isOpen: () => open })).resolves.toBe(false)
    expect(toast.toasts.value).toHaveLength(1)
    open = false
    const entry = toast.toasts.value[0]
    entry?.action?.run(entry.id)
    await Bun.sleep(0)

    expect(attempts).toBe(1)
    expect(toast.toasts.value).toHaveLength(0)
  })

  test('shows one failure per document, the latest, and says when one was showing', async () => {
    const key = {}
    const retry = async () => undefined
    expect(showSaveFailure('first', retry, { key })).toBe(false)
    expect(showSaveFailure('second', retry, { key })).toBe(true)
    expect(toast.toasts.value.map((entry) => entry.message)).toEqual(['second'])

    await expect(saveWithFeedback(async () => true, { key })).resolves.toBe(true)
    expect(toast.toasts.value).toHaveLength(0)
    expect(showSaveFailure('third', retry, { key })).toBe(false)
  })

  test('keeps each document’s failure apart, and a save that did not happen keeps it', async () => {
    const first = {}
    const second = {}
    const retried: string[] = []
    showSaveFailure('disk full', async () => retried.push('first'), { key: first })
    showSaveFailure('disk full', async () => retried.push('second'), { key: second })
    expect(toast.toasts.value).toHaveLength(2)

    await expect(saveWithFeedback(async () => false, { key: first })).resolves.toBe(false)
    expect(toast.toasts.value).toHaveLength(2)
    await expect(saveWithFeedback(async () => true, { key: first })).resolves.toBe(true)
    const left = toast.toasts.value[0]
    expect(toast.toasts.value).toHaveLength(1)
    left?.action?.run(left.id)
    expect(retried).toEqual(['second'])

    // A retry keeps the failure until it saves.
    expect(toast.toasts.value).toHaveLength(1)
    await expect(saveWithFeedback(async () => true, { key: second })).resolves.toBe(true)
    expect(toast.toasts.value).toHaveLength(0)
  })

  test('shows nothing for a save that fails after its document closed', async () => {
    const failed = saveWithFeedback(
      async () => {
        throw new Error('disk full')
      },
      { key: {}, isOpen: () => false }
    )
    await expect(failed).resolves.toBe(false)
    expect(toast.toasts.value).toHaveLength(0)
  })

  test('shows nothing when a background save’s retry fails once the document is clean', async () => {
    const save = async () => {
      throw new Error('disk full')
    }
    const options = { key: {}, hasUnsavedChanges: () => false }
    await expect(saveWithFeedback(save, { ...options, background: true })).resolves.toBe(false)
    expect(toast.toasts.value).toHaveLength(0)
    // A save the person asked for still says it failed.
    await expect(saveWithFeedback(save, options)).resolves.toBe(false)
    expect(toast.toasts.value).toHaveLength(1)
  })

  test('ignores Retry while that document’s retry is still saving', async () => {
    const key = {}
    let attempts = 0
    const saving = createDeferred<undefined>()
    showSaveFailure(
      'disk full',
      () => {
        attempts += 1
        return saving.promise
      },
      { key }
    )
    const entry = toast.toasts.value[0]
    entry?.action?.run(entry.id)
    entry?.action?.run(entry.id)
    expect(attempts).toBe(1)

    saving.resolve(undefined)
    await Bun.sleep(0)
    entry?.action?.run(entry.id)
    expect(attempts).toBe(2)
  })

  test('claims one notice per run of failures, which a save or another failure’s save ends', async () => {
    const key = {}
    const retry = async () => undefined
    showSaveFailure('disk full', retry, { key })
    expect(claimFailureNotice(key)).toBe(true)
    showSaveFailure('disk full', retry, { key })
    expect(claimFailureNotice(key)).toBe(false)

    await expect(saveWithFeedback(async () => true, { key })).resolves.toBe(true)
    // A manual save's failure starts a new run, which the next autosave failure still notifies.
    await expect(
      saveWithFeedback(
        async () => {
          throw new Error('disk full')
        },
        { key }
      )
    ).resolves.toBe(false)
    expect(claimFailureNotice(key)).toBe(true)
  })
})
