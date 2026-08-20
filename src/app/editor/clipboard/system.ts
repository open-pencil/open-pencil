import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { getInMemoryClipboardHTML, setInMemoryClipboardHTML } from '@/app/editor/clipboard/memory'
import { readTauriClipboardText, writeTauriClipboardHTML } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

const noop = () => undefined

class MockDataTransfer implements DataTransfer {
  private data = new Map<string, string>()

  dropEffect: 'none' | 'copy' | 'link' | 'move' = 'none'
  effectAllowed:
    | 'none'
    | 'copy'
    | 'copyLink'
    | 'copyMove'
    | 'link'
    | 'linkMove'
    | 'move'
    | 'all'
    | 'uninitialized' = 'none'
  files: FileList = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {
      yield* []
    }
  } as FileList
  items: DataTransferItemList = {
    length: 0,
    add: () => null,
    clear: noop,
    remove: noop,
    [Symbol.iterator]: function* () {
      yield* []
    }
  } as DataTransferItemList

  setData(format: string, data: string): void {
    this.data.set(format, data)
  }

  getData(format: string): string {
    return this.data.get(format) ?? ''
  }

  clearData(format?: string): void {
    if (format) this.data.delete(format)
    else this.data.clear()
  }

  setDragImage(image: Element, x: number, y: number): void {
    void image
    void x
    void y
  }

  get types(): readonly string[] {
    return [...this.data.keys()]
  }
}

function createTransfer(): DataTransfer {
  if (typeof DataTransfer !== 'undefined') {
    try {
      return new DataTransfer()
    } catch (error) {
      console.warn('DataTransfer instantiation failed', error)
    }
  }
  return new MockDataTransfer()
}

function isDesignClipboardHTML(text: string) {
  return text.includes('<!--(openpencil)') || text.includes('(figma)')
}

export async function copySelectionToTauriClipboard(store: EditorStore) {
  if (!isTauri()) return false
  try {
    const transfer = createTransfer()
    await store.writeCopyData(transfer)
    const html = transfer.getData('text/html')
    const plainText = transfer.getData('text/plain')
    if (html) setInMemoryClipboardHTML(html)
    if (!html && !plainText) return false
    await writeTauriClipboardHTML(html || plainText, plainText)
    return true
  } catch (error) {
    console.warn('Tauri clipboard copy failed', error)
    return false
  }
}

export async function copySelectionToBrowserClipboard(store: EditorStore): Promise<boolean> {
  try {
    const transfer = createTransfer()
    await store.writeCopyData(transfer)
    const html = transfer.getData('text/html')
    const plainText = transfer.getData('text/plain')
    if (html) setInMemoryClipboardHTML(html)
    if (!html && !plainText) return false

    if (
      typeof ClipboardItem !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof (navigator as Partial<Navigator>).clipboard?.write === 'function'
    ) {
      try {
        const itemData: Record<string, Blob> = {}
        if (html) itemData['text/html'] = new Blob([html], { type: 'text/html' })
        if (plainText) itemData['text/plain'] = new Blob([plainText], { type: 'text/plain' })
        await navigator.clipboard.write([new ClipboardItem(itemData)])
        return true
      } catch (error) {
        console.warn('Modern clipboard write failed', error)
      }
    }

    if (typeof document !== 'undefined') {
      let listener: ((event: ClipboardEvent) => void) | null = null
      try {
        const copyState = { payloadCopied: false }
        listener = (event: ClipboardEvent) => {
          if (event.clipboardData) {
            if (html) event.clipboardData.setData('text/html', html)
            if (plainText) event.clipboardData.setData('text/plain', plainText)
            event.preventDefault()
            copyState.payloadCopied = true
          }
        }
        document.addEventListener('copy', listener)
        const success = document.execCommand('copy')
        if (success && copyState.payloadCopied) return true
      } catch (error) {
        console.warn('execCommand copy fallback failed', error)
      } finally {
        if (listener) {
          document.removeEventListener('copy', listener)
        }
      }
    }

    return false
  } catch (error) {
    console.warn('Browser clipboard copy failed', error)
    return false
  }
}

export async function pasteFromTauriClipboard(store: EditorStore, cursorPos?: Vector) {
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

export async function pasteFromBrowserClipboard(
  store: EditorStore,
  cursorPos?: Vector
): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Partial<Navigator>).clipboard?.read === 'function'
  ) {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html')
          const html = await blob.text()
          if (html && isDesignClipboardHTML(html)) {
            await store.pasteFromHTML(html, cursorPos)
            return true
          }
        }
      }
    } catch (error) {
      console.warn('Browser clipboard read failed', error)
    }
  }

  const memoryHTML = getInMemoryClipboardHTML()
  if (memoryHTML && isDesignClipboardHTML(memoryHTML)) {
    await store.pasteFromHTML(memoryHTML, cursorPos)
    return true
  }

  return false
}

export async function executeClipboardCommand(
  store: EditorStore,
  command: 'copy' | 'cut' | 'paste',
  cursorPos?: Vector
) {
  if (command === 'copy') {
    if (isTauri()) return copySelectionToTauriClipboard(store)
    return copySelectionToBrowserClipboard(store)
  }

  if (command === 'cut') {
    const copied = isTauri()
      ? await copySelectionToTauriClipboard(store)
      : await copySelectionToBrowserClipboard(store)
    if (copied) {
      store.deleteSelected()
      return true
    }
    return false
  }

  if (isTauri()) return pasteFromTauriClipboard(store, cursorPos)
  return pasteFromBrowserClipboard(store, cursorPos)
}
