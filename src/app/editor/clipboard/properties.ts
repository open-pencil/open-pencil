import type { EditorStore } from '@/app/editor/active-store'
import { matchingClipboardSnapshot } from '@/app/editor/clipboard/memory'
import { readClipboardHTML } from '@/app/editor/clipboard/read'
import { resolveSystemClipboard } from '@/app/editor/clipboard/system'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

/** Copy properties: the selection on the system clipboard, marked so Paste skips it, as in Figma. */
export async function copySelectionProperties(store: EditorStore) {
  if (store.state.selectedIds.size === 0) return
  const messages = notificationMessages.get()
  if (await resolveSystemClipboard().copy(store, { properties: true }))
    toast.info(messages.copiedProperties)
  else toast.error(messages.clipboardAccessBlocked)
}

/** Paste properties: the look of the one copied layer, from here, another tab, or Figma. */
export async function pasteClipboardProperties(store: EditorStore) {
  if (store.state.selectedIds.size === 0) return
  try {
    const html = await readClipboardHTML()
    if (!html) {
      toast.error(notificationMessages.get().clipboardMissingDesignData)
      return
    }
    const snapshot = matchingClipboardSnapshot(html)
    if (snapshot) await store.pastePropertiesFromSnapshot(snapshot)
    else await store.pastePropertiesFromHTML(html)
  } catch (error) {
    console.warn('Paste properties failed', error)
    toast.error(notificationMessages.get().clipboardAccessBlocked)
  }
}
