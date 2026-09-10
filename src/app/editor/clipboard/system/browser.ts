import copy from 'copy-to-clipboard'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { isDesignClipboardHTML } from '@/app/editor/clipboard/html'
import {
  clearInMemoryClipboardHTML,
  getInMemoryClipboardHTML,
  setInMemoryClipboardPayload
} from '@/app/editor/clipboard/memory'
import { pasteClipboardHTML } from '@/app/editor/clipboard/paste'
import type {
  BrowserClipboardIO,
  BrowserClipboardReadResult,
  ClipboardPayload,
  SystemClipboard
} from '@/app/editor/clipboard/system/types'

function populateLegacyClipboard(data: DataTransfer, payload: ClipboardPayload): void {
  if (payload.html) data.setData('text/html', payload.html)
  if (payload.plainText) data.setData('text/plain', payload.plainText)
}

async function writeBrowserClipboard(payload: Promise<ClipboardPayload>): Promise<boolean> {
  let ready: ClipboardPayload | undefined
  const prepared = payload.then((value) => {
    ready = value
    return value
  })
  // The library starts the async Clipboard API write within the user gesture.
  // Its synchronous fallback may only use a payload that has actually completed.
  return copy('', {
    format: 'text/html',
    onCopy: (data) => {
      if (typeof DataTransfer !== 'undefined' && data instanceof DataTransfer) {
        if (!ready) throw new Error('Clipboard payload is not ready for synchronous copying')
        populateLegacyClipboard(data, ready)
        return undefined
      }
      return new ClipboardItem({
        'text/html': prepared.then((value) => new Blob([value.html], { type: 'text/html' })),
        'text/plain': prepared.then((value) => new Blob([value.plainText], { type: 'text/plain' }))
      })
    }
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
    if (store.state.selectedIds.size === 0) return false
    const prepared = store.prepareCopy()
    const writing = io.write(prepared)
    const [payload, written] = await Promise.all([prepared, writing])
    if (!payload.html && !payload.plainText) return false
    if (written && payload.html) setInMemoryClipboardPayload(payload)
    else if (!written) clearInMemoryClipboardHTML()

    return written
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
      await pasteClipboardHTML(store, result.html, cursorPos)
      return true
    }
    return false
  }

  const memoryHTML = getInMemoryClipboardHTML()
  if (memoryHTML && isDesignClipboardHTML(memoryHTML)) {
    await pasteClipboardHTML(store, memoryHTML, cursorPos)
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
