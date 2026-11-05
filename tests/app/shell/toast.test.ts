import { afterEach, describe, expect, test } from 'bun:test'

import { toast, toastDuration } from '@/app/shell/ui'

function entryAt(index = 0) {
  const entry = toast.toasts.value[index]
  if (!entry) throw new Error(`Missing toast at index ${index}`)
  return entry
}

afterEach(() => {
  for (const entry of toast.toasts.value) toast.remove(entry.id)
})

describe('toast progress', () => {
  test('keeps a reported-progress toast open until progress clears', () => {
    const handle = toast.startProgress('Downloading OpenPencil 0.15.1')

    expect(entryAt().progress).toEqual({})
    expect(toastDuration(entryAt())).toBe(0)

    handle.update({ progress: { value: 5, max: 10 }, progressLabel: '50%' })
    expect(entryAt().progressLabel).toBe('50%')
    expect(toastDuration(entryAt())).toBe(0)

    handle.update({ progress: null, progressLabel: null })
    expect(entryAt().progress).toBeUndefined()
    expect(entryAt().progressLabel).toBeUndefined()
    expect(toastDuration(entryAt())).toBe(toast.TOAST_DURATION)
  })

  test('updates one toast in place instead of stacking every chunk', () => {
    const handle = toast.startProgress('Downloading OpenPencil 0.15.1')

    handle.update({ message: 'Downloading OpenPencil 0.15.1' })
    handle.update({ progressLabel: '42% · 9.6 MiB of 22.9 MiB' })

    expect(toast.toasts.value).toHaveLength(1)
    expect(entryAt().progressLabel).toBe('42% · 9.6 MiB of 22.9 MiB')
  })

  test('does not merge a repeated message into a progress toast', () => {
    const handle = toast.startProgress('Downloading OpenPencil 0.15.1')

    toast.info('Downloading OpenPencil 0.15.1')

    expect(toast.toasts.value).toHaveLength(2)
    expect(entryAt().progress).toEqual({})
    handle.dismiss()
    expect(toast.toasts.value).toHaveLength(1)
  })

  test('errors keep their longer duration only without reported progress', () => {
    toast.warning('Storage workspace is offline')
    expect(toastDuration(entryAt())).toBe(toast.TOAST_DURATION)

    toast.error('Could not save the document')
    expect(toastDuration(entryAt(1))).toBe(toast.ERROR_TOAST_DURATION)
  })

  test('ignores updates to a toast that was trimmed away', () => {
    const dropped = toast.startProgress('First download')
    for (let index = 0; index < 5; index += 1) toast.info(`Message ${index}`)

    expect(toast.toasts.value.map((entry) => entry.message)).not.toContain('First download')

    dropped.update({ progressLabel: 'ignored' })

    expect(toast.toasts.value.map((entry) => entry.progressLabel)).not.toContain('ignored')
  })
})
