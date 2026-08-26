import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { getInMemoryClipboardHTML, setInMemoryClipboardHTML } from '@/app/editor/clipboard/memory'
import {
  createClipboardTransfer,
  isDesignClipboardHTML
} from '@/app/editor/clipboard/system/shared'
import type {
  BrowserClipboardEnvironment,
  ClipboardPayload,
  SystemClipboard
} from '@/app/editor/clipboard/system/types'

async function writeModernBrowserClipboard(payload: ClipboardPayload): Promise<boolean> {
  if (
    typeof ClipboardItem === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof navigator === 'undefined' ||
    typeof (navigator as Partial<Navigator>).clipboard?.write !== 'function'
  ) {
    return false
  }
  try {
    const itemData: Record<string, Blob> = {}
    if (payload.html) itemData['text/html'] = new Blob([payload.html], { type: 'text/html' })
    if (payload.plainText) {
      itemData['text/plain'] = new Blob([payload.plainText], { type: 'text/plain' })
    }
    await navigator.clipboard.write([new ClipboardItem(itemData)])
    return true
  } catch (error) {
    console.warn('Modern clipboard write failed', error)
    return false
  }
}

function writeLegacyBrowserClipboard(payload: ClipboardPayload): boolean {
  if (
    typeof document === 'undefined' ||
    typeof (document as Partial<Document>).execCommand !== 'function'
  ) {
    return false
  }
  let payloadCopied = false
  const listener = (event: ClipboardEvent) => {
    if (!event.clipboardData) return
    if (payload.html) event.clipboardData.setData('text/html', payload.html)
    if (payload.plainText) event.clipboardData.setData('text/plain', payload.plainText)
    event.preventDefault()
    payloadCopied = true
  }
  try {
    document.addEventListener('copy', listener)
    return document.execCommand('copy') && payloadCopied
  } catch (error) {
    console.warn('execCommand copy fallback failed', error)
    return false
  } finally {
    document.removeEventListener('copy', listener)
  }
}

async function readModernBrowserClipboardHTML(): Promise<string | null> {
  if (
    typeof navigator === 'undefined' ||
    typeof (navigator as Partial<Navigator>).clipboard?.read !== 'function'
  ) {
    return null
  }
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      if (!item.types.includes('text/html')) continue
      return await (await item.getType('text/html')).text()
    }
  } catch (error) {
    console.warn('Browser clipboard read failed', error)
  }
  return null
}

export function createBrowserClipboardEnvironment(): BrowserClipboardEnvironment {
  return {
    write: writeModernBrowserClipboard,
    writeLegacy: writeLegacyBrowserClipboard,
    readHTML: readModernBrowserClipboardHTML
  }
}

export async function copySelectionToBrowserClipboard(
  store: EditorStore,
  environment: BrowserClipboardEnvironment = createBrowserClipboardEnvironment()
): Promise<boolean> {
  try {
    const transfer = createClipboardTransfer()
    await store.writeCopyData(transfer)
    const payload: ClipboardPayload = {
      html: transfer.getData('text/html'),
      plainText: transfer.getData('text/plain')
    }
    if (!payload.html && !payload.plainText) return false
    if (payload.html) setInMemoryClipboardHTML(payload.html)

    if (environment.write && (await environment.write(payload))) return true
    return environment.writeLegacy?.(payload) ?? false
  } catch (error) {
    console.warn('Browser clipboard copy failed', error)
    return false
  }
}

export async function pasteFromBrowserClipboard(
  store: EditorStore,
  cursorPos?: Vector,
  environment: BrowserClipboardEnvironment = createBrowserClipboardEnvironment()
): Promise<boolean> {
  const html = await environment.readHTML?.()
  if (html && isDesignClipboardHTML(html)) {
    await store.pasteFromHTML(html, cursorPos)
    return true
  }

  const memoryHTML = getInMemoryClipboardHTML()
  if (memoryHTML && isDesignClipboardHTML(memoryHTML)) {
    await store.pasteFromHTML(memoryHTML, cursorPos)
    return true
  }

  return false
}

export function createBrowserSystemClipboard(
  environment: BrowserClipboardEnvironment = createBrowserClipboardEnvironment()
): SystemClipboard {
  return {
    copy: (store) => copySelectionToBrowserClipboard(store, environment),
    paste: (store, cursorPos) => pasteFromBrowserClipboard(store, cursorPos, environment)
  }
}
