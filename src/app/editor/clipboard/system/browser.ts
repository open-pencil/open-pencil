import copy, { type Options as ClipboardCopyOptions } from 'copy-to-clipboard'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { isDesignClipboardHTML } from '@/app/editor/clipboard/html'
import { getInMemoryClipboardHTML, setInMemoryClipboardHTML } from '@/app/editor/clipboard/memory'
import { createClipboardTransfer } from '@/app/editor/clipboard/system/transfer'
import type {
  BrowserClipboardIO,
  BrowserClipboardReadResult,
  ClipboardPayload,
  SystemClipboard
} from '@/app/editor/clipboard/system/types'

function clipboardItem(payload: ClipboardPayload): ClipboardItem | undefined {
  if (typeof Blob === 'undefined' || typeof ClipboardItem === 'undefined') return undefined
  const itemData: Record<string, Blob> = {}
  if (payload.html) itemData['text/html'] = new Blob([payload.html], { type: 'text/html' })
  if (payload.plainText) {
    itemData['text/plain'] = new Blob([payload.plainText], { type: 'text/plain' })
  }
  return new ClipboardItem(itemData)
}

function populateLegacyClipboard(data: DataTransfer, payload: ClipboardPayload): void {
  if (payload.html) data.setData('text/html', payload.html)
  if (payload.plainText) data.setData('text/plain', payload.plainText)
}

function customizeClipboardPayload(
  payload: ClipboardPayload
): NonNullable<ClipboardCopyOptions['onCopy']> {
  return (data) => {
    if (typeof DataTransfer !== 'undefined' && data instanceof DataTransfer) {
      populateLegacyClipboard(data, payload)
      return undefined
    }
    return clipboardItem(payload)
  }
}

async function writeBrowserClipboard(payload: ClipboardPayload): Promise<boolean> {
  const text = payload.html || payload.plainText
  return copy(text, {
    format: payload.html ? 'text/html' : 'text/plain',
    onCopy: customizeClipboardPayload(payload)
  })
}

async function readBrowserClipboardHTML(): Promise<BrowserClipboardReadResult> {
  if (
    typeof navigator === 'undefined' ||
    typeof (navigator as Partial<Navigator>).clipboard?.read !== 'function'
  ) {
    return { available: false }
  }
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      if (!item.types.includes('text/html')) continue
      return { available: true, html: await (await item.getType('text/html')).text() }
    }
    return { available: true, html: null }
  } catch (error) {
    console.warn('Browser clipboard read failed', error)
    return { available: false }
  }
}

const browserClipboardIO: BrowserClipboardIO = {
  write: writeBrowserClipboard,
  readHTML: readBrowserClipboardHTML
}

async function copySelection(store: EditorStore, io: BrowserClipboardIO): Promise<boolean> {
  try {
    const transfer = createClipboardTransfer()
    await store.writeCopyData(transfer)
    const payload: ClipboardPayload = {
      html: transfer.getData('text/html'),
      plainText: transfer.getData('text/plain')
    }
    if (!payload.html && !payload.plainText) return false
    if (payload.html) setInMemoryClipboardHTML(payload.html, payload.plainText)

    return await io.write(payload)
  } catch (error) {
    console.warn('Browser clipboard copy failed', error)
    return false
  }
}

async function pasteSelection(
  store: EditorStore,
  cursorPos: Vector | undefined,
  io: BrowserClipboardIO
): Promise<boolean> {
  const result = await io.readHTML()
  if (result.available) {
    if (result.html && isDesignClipboardHTML(result.html)) {
      await store.pasteFromHTML(result.html, cursorPos)
      return true
    }
    return false
  }

  const memoryHTML = getInMemoryClipboardHTML()
  if (memoryHTML && isDesignClipboardHTML(memoryHTML)) {
    await store.pasteFromHTML(memoryHTML, cursorPos)
    return true
  }

  return false
}

export function createBrowserSystemClipboard(
  io: BrowserClipboardIO = browserClipboardIO
): SystemClipboard {
  return {
    copy: (store) => copySelection(store, io),
    paste: (store, cursorPos) => pasteSelection(store, cursorPos, io)
  }
}

export const browserSystemClipboard = createBrowserSystemClipboard()
