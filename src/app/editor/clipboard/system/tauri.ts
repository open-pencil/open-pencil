import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { isDesignClipboardHTML } from '@/app/editor/clipboard/html'
import { getInMemoryClipboardHTML, setInMemoryClipboardHTML } from '@/app/editor/clipboard/memory'
import { createClipboardTransfer } from '@/app/editor/clipboard/system/transfer'
import type { SystemClipboard } from '@/app/editor/clipboard/system/types'
import {
  readTauriClipboardText,
  writeTauriClipboardHTML,
  writeTauriClipboardText
} from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

async function copySelection(store: EditorStore): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const transfer = createClipboardTransfer()
    await store.writeCopyData(transfer)
    const html = transfer.getData('text/html')
    const plainText = transfer.getData('text/plain')
    if (!html && !plainText) return false
    if (html) {
      await writeTauriClipboardHTML(html, plainText)
      setInMemoryClipboardHTML(html, plainText)
    } else {
      await writeTauriClipboardText(plainText)
    }
    return true
  } catch (error) {
    console.warn('Tauri clipboard copy failed', error)
    return false
  }
}

async function pasteSelection(store: EditorStore, cursorPos?: Vector): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const text = await readTauriClipboardText()
    if (text && isDesignClipboardHTML(text)) {
      await store.pasteFromHTML(text, cursorPos)
      return true
    }
    const matchingMemoryHTML = getInMemoryClipboardHTML(text ?? '')
    if (matchingMemoryHTML && isDesignClipboardHTML(matchingMemoryHTML)) {
      await store.pasteFromHTML(matchingMemoryHTML, cursorPos)
      return true
    }
    return false
  } catch (error) {
    console.warn('Tauri clipboard paste failed', error)
    return false
  }
}

export const tauriSystemClipboard: SystemClipboard = {
  copy: copySelection,
  paste: pasteSelection
}
