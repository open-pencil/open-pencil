import type { EditorStore } from '@/app/editor/active-store'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { readTauriClipboardText } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

function isDesignClipboardHTML(text: string) {
  return text.includes('<!--(openpencil)') || text.includes('(figma)')
}

async function readClipboardHTML() {
  if (isTauri()) {
    const text = await readTauriClipboardText()
    return text && isDesignClipboardHTML(text) ? text : null
  }

  if (typeof navigator.clipboard.read !== 'function') return null
  const items = await navigator.clipboard.read()
  for (const item of items) {
    if (!item.types.includes('text/html')) continue
    return (await item.getType('text/html')).text()
  }
  return null
}

export async function pasteClipboardToReplace(store: EditorStore) {
  try {
    const html = await readClipboardHTML()
    if (!html) {
      toast.error(notificationMessages.get().clipboardMissingDesignData)
      return
    }
    await store.pasteFromHTML(html, undefined, { replaceSelection: true })
  } catch (error) {
    console.warn('Paste to replace failed', error)
    toast.error(notificationMessages.get().clipboardAccessBlocked)
  }
}
