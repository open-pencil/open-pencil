import type { EditorStore } from '@/app/editor/active-store'
import { pasteClipboardHTML } from '@/app/editor/clipboard/paste/content'
import { readClipboardHTML } from '@/app/editor/clipboard/read'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

export async function pasteClipboardToReplace(store: EditorStore) {
  try {
    const html = await readClipboardHTML()
    if (!html) {
      toast.error(notificationMessages.get().clipboardMissingDesignData)
      return
    }
    await pasteClipboardHTML(store, html, undefined, { replaceSelection: true })
  } catch (error) {
    console.warn('Paste to replace failed', error)
    toast.error(notificationMessages.get().clipboardAccessBlocked)
  }
}
