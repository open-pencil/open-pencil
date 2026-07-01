import type { EditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import { readTauriClipboardText } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

function isDesignClipboardHtml(text: string) {
  return text.includes('<!--(openpencil)') || text.includes('(figma)')
}

async function readClipboardHtml() {
  if (isTauri()) {
    const text = await readTauriClipboardText()
    return text && isDesignClipboardHtml(text) ? text : null
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
    const html = await readClipboardHtml()
    if (!html) {
      toast.error('Clipboard does not contain design data')
      return
    }
    await store.pasteFromHTML(html, undefined, { replaceSelection: true })
  } catch (error) {
    console.warn('Paste to replace failed', error)
    toast.error('Clipboard access is blocked in this browser context')
  }
}
