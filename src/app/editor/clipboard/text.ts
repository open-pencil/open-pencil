import { useClipboard } from '@vueuse/core'

import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { writeTauriClipboardText } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

/** Copy text through the native clipboard on desktop and the browser's elsewhere, then confirm. */
export function createTextClipboard() {
  const { copy } = useClipboard()
  return async function copyText(text: string, label: string): Promise<void> {
    if (isTauri()) await writeTauriClipboardText(text)
    else await copy(text)
    toast.info(notificationMessages.get().copiedAs({ format: label }))
  }
}
