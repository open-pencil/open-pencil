import { afterEach, describe, expect, test } from 'bun:test'

import { saveWithFeedback } from '@/app/document/io/save/feedback'
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
    await new Promise((resolve) => setTimeout(resolve, 0))

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
    await expect(saveWithFeedback(save, { key })).resolves.toBe(true)
    expect(toast.toasts.value).toHaveLength(0)
  })

  test('does not retry a document that is no longer open', async () => {
    let attempts = 0
    const key = {}
    const save = async () => {
      attempts += 1
      throw new Error('disk full')
    }

    await expect(saveWithFeedback(save, { key, isOpen: () => false })).resolves.toBe(false)
    const entry = toast.toasts.value[0]
    entry?.action?.run(entry.id)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(attempts).toBe(1)
    expect(toast.toasts.value).toHaveLength(0)
  })
})
