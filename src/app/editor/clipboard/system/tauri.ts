import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { isDesignClipboardHTML } from '@/app/editor/clipboard/html'
import {
  clearInMemoryClipboardHTML,
  getInMemoryClipboardHTML,
  setInMemoryClipboardPayload
} from '@/app/editor/clipboard/memory'
import { pasteClipboardHTML } from '@/app/editor/clipboard/paste'
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
    const payload = await store.prepareCopy()
    const { html, plainText } = payload
    if (!html && !plainText) return false
    if (html) {
      await writeTauriClipboardHTML(html, plainText)
      setInMemoryClipboardPayload(payload)
    } else {
      await writeTauriClipboardText(plainText)
      clearInMemoryClipboardHTML()
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
      await pasteClipboardHTML(store, text, cursorPos)
      return true
    }
    const matchingMemoryHTML = getInMemoryClipboardHTML(text ?? '')
    if (matchingMemoryHTML && isDesignClipboardHTML(matchingMemoryHTML)) {
      await pasteClipboardHTML(store, matchingMemoryHTML, cursorPos)
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
