import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { getInMemoryClipboardHTML, setInMemoryClipboardHTML } from '@/app/editor/clipboard/memory'
import {
  createClipboardTransfer,
  isDesignClipboardHTML
} from '@/app/editor/clipboard/system/shared'
import type { SystemClipboard } from '@/app/editor/clipboard/system/types'
import { readTauriClipboardText, writeTauriClipboardHTML } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

export async function copySelectionToTauriClipboard(store: EditorStore): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const transfer = createClipboardTransfer()
    await store.writeCopyData(transfer)
    const html = transfer.getData('text/html')
    const plainText = transfer.getData('text/plain')
    if (!html && !plainText) return false
    await writeTauriClipboardHTML(html || plainText, plainText)
    if (html) setInMemoryClipboardHTML(html)
    return true
  } catch (error) {
    console.warn('Tauri clipboard copy failed', error)
    return false
  }
}

export async function pasteFromTauriClipboard(
  store: EditorStore,
  cursorPos?: Vector
): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const text = await readTauriClipboardText()
    if (text && isDesignClipboardHTML(text)) {
      await store.pasteFromHTML(text, cursorPos)
      return true
    }
  } catch (error) {
    console.warn('Tauri clipboard paste failed', error)
  }

  const memoryHTML = getInMemoryClipboardHTML()
  if (memoryHTML && isDesignClipboardHTML(memoryHTML)) {
    await store.pasteFromHTML(memoryHTML, cursorPos)
    return true
  }

  return false
}

export const tauriSystemClipboard: SystemClipboard = {
  copy: copySelectionToTauriClipboard,
  paste: pasteFromTauriClipboard
}
