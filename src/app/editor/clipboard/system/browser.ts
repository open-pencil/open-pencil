import copy, { type Options as ClipboardCopyOptions } from 'copy-to-clipboard'

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

function clipboardItem(payload: ClipboardPayload): ClipboardItem {
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
    write: writeBrowserClipboard,
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

    return (await environment.write?.(payload)) ?? false
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
