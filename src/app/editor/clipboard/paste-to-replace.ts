import type { EditorStore } from '@/app/editor/active-store'
import { getInMemoryClipboardHTML } from '@/app/editor/clipboard/memory'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { readTauriClipboardText } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

function isDesignClipboardHTML(text: string) {
  return text.includes('<!--(openpencil)') || text.includes('(figma)')
}

async function readClipboardHTML() {
  if (isTauri()) {
    try {
      const text = await readTauriClipboardText()
      if (text && isDesignClipboardHTML(text)) return text
    } catch (error) {
      console.warn('Tauri clipboard read failed', error)
    }
    const memory = getInMemoryClipboardHTML()
    return memory && isDesignClipboardHTML(memory) ? memory : null
  }

  if (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Partial<Navigator>).clipboard?.read === 'function'
  ) {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        if (!item.types.includes('text/html')) continue
        const text = await (await item.getType('text/html')).text()
        if (text && isDesignClipboardHTML(text)) return text
      }
    } catch (error) {
      console.warn('System clipboard read failed', error)
    }
  }

  const memory = getInMemoryClipboardHTML()
  return memory && isDesignClipboardHTML(memory) ? memory : null
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
