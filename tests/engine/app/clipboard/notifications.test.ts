import { afterEach, describe, expect, test } from 'bun:test'

import { notifyClipboardImageResolution } from '@/app/editor/clipboard/notifications'
import { toast } from '@/app/shell/ui'

afterEach(() => {
  toast.toasts.value = []
})

describe('clipboard image notifications', () => {
  test('warns web users when pasted images cannot be fetched', () => {
    notifyClipboardImageResolution({ total: 2, missing: 2, fetchAttempted: false })

    expect(toast.toasts.value).toHaveLength(1)
    expect(toast.toasts.value[0]).toMatchObject({
      variant: 'warning',
      message:
        'Pasted design includes 2 images that cannot be loaded in the web app. Use the desktop app to include them.'
    })
  })

  test('shows an actionable desktop error for partial failures', () => {
    notifyClipboardImageResolution({ total: 3, missing: 1, fetchAttempted: true })

    expect(toast.toasts.value).toHaveLength(1)
    expect(toast.toasts.value[0]).toMatchObject({
      variant: 'error',
      message:
        'Failed to fetch 1 image from Figma. Check that the source file is accessible and try again.'
    })
  })
})
