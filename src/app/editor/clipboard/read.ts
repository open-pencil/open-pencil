import { isDesignClipboardHTML } from '@/app/editor/clipboard/html'
import { getInMemoryClipboardHTML, rememberedWebHTML } from '@/app/editor/clipboard/memory'
import type { WebClipboard } from '@/app/editor/clipboard/paste/web'
import { readTauriClipboardText } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

/** The browser's asynchronous clipboard, where this context has one. */
function browserClipboard(): Pick<Clipboard, 'read'> | undefined {
  if (typeof navigator === 'undefined') return undefined
  const { clipboard } = navigator as Partial<Navigator>
  return typeof clipboard?.read === 'function' ? clipboard : undefined
}

/** The design layers on the system clipboard, or the last copy made here when it cannot be read. */
export async function readClipboardHTML(
  clipboard: Pick<Clipboard, 'read'> | undefined = browserClipboard()
): Promise<string | null> {
  if (isTauri()) {
    try {
      const text = await readTauriClipboardText()
      if (isDesignClipboardHTML(text ?? '')) return text
      const memory = getInMemoryClipboardHTML(text ?? '')
      return memory && isDesignClipboardHTML(memory) ? memory : null
    } catch (error) {
      console.warn('Tauri clipboard read failed', error)
      const memory = getInMemoryClipboardHTML()
      return memory && isDesignClipboardHTML(memory) ? memory : null
    }
  }

  if (clipboard) {
    try {
      const items = await clipboard.read()
      for (const item of items) {
        if (!item.types.includes('text/html')) continue
        const text = await (await item.getType('text/html')).text()
        if (text && isDesignClipboardHTML(text)) return text
      }
      // A readable clipboard without design layers holds something newer than our last copy.
      return null
    } catch (error) {
      console.warn('System clipboard read failed', error)
    }
  }

  const memory = getInMemoryClipboardHTML()
  return memory && isDesignClipboardHTML(memory) ? memory : null
}

/**
 * What the clipboard holds for Paste as layers: its HTML and text. On the desktop the plugin
 * reads text only, so the HTML is the one last pasted here while the text still matches.
 */
export async function readWebClipboard(
  clipboard: Pick<Clipboard, 'read'> | undefined = browserClipboard()
): Promise<WebClipboard> {
  if (isTauri()) {
    const text = (await readTauriClipboardText().catch(() => null)) ?? ''
    return { html: rememberedWebHTML(text), text }
  }
  if (!clipboard) return { html: '', text: '' }
  const read = async (item: ClipboardItem, type: string) =>
    item.types.includes(type) ? (await item.getType(type)).text() : ''
  try {
    for (const item of await clipboard.read()) {
      const html = await read(item, 'text/html')
      const text = await read(item, 'text/plain')
      if (html || text) return { html, text }
    }
  } catch (error) {
    console.warn('System clipboard read failed', error)
  }
  return { html: '', text: '' }
}
