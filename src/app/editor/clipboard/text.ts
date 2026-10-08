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

/**
 * Copy text that is still being produced. Browsers accept a clipboard write only during the
 * user's click, so the write starts at once with a promise of the text; awaiting the text first
 * can outlast that window in Safari and Firefox. A rejected promise copies nothing.
 */
export async function copyPendingText(text: Promise<string>, label: string): Promise<void> {
  if (isTauri()) {
    await writeTauriClipboardText(await text)
  } else {
    const blob = text.then((value) => new Blob([value], { type: 'text/plain' }))
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
  }
  toast.info(notificationMessages.get().copiedAs({ format: label }))
}
