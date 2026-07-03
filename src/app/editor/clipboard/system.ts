import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { readTauriClipboardText, writeTauriClipboardHtml } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

function createTransfer() {
  if (typeof DataTransfer === 'undefined') return null
  return new DataTransfer()
}

function isDesignClipboardHtml(text: string) {
  return text.includes('<!--(openpencil)') || text.includes('(figma)')
}

export async function copySelectionToTauriClipboard(store: EditorStore) {
  if (!isTauri()) return false
  try {
    const transfer = createTransfer()
    if (!transfer) return false
    await store.writeCopyData(transfer)
    const html = transfer.getData('text/html')
    const plainText = transfer.getData('text/plain')
    if (!html && !plainText) return false
    await writeTauriClipboardHtml(html || plainText, plainText)
    return true
  } catch (error) {
    console.warn('Tauri clipboard copy failed', error)
    return false
  }
}

export async function pasteFromTauriClipboard(store: EditorStore, cursorPos?: Vector) {
  if (!isTauri()) return false
  try {
    const text = await readTauriClipboardText()
    if (!text || !isDesignClipboardHtml(text)) return false
    await store.pasteFromHTML(text, cursorPos)
    return true
  } catch (error) {
    console.warn('Tauri clipboard paste failed', error)
    return false
  }
}

export async function executeClipboardCommand(
  store: EditorStore,
  command: 'copy' | 'cut' | 'paste'
) {
  if (command === 'copy') {
    if (await copySelectionToTauriClipboard(store)) return true
  }

  if (command === 'cut') {
    if (await copySelectionToTauriClipboard(store)) {
      store.deleteSelected()
      return true
    }
  }

  if (command === 'paste') {
    if (await pasteFromTauriClipboard(store)) return true
  }

  try {
    return document.execCommand(command)
  } catch (error) {
    console.warn(`Clipboard command ${command} failed`, error)
    return false
  }
}
