import type { ClipboardPayload } from '@/app/editor/clipboard/system/types'

let memoryClipboard: ClipboardPayload = { html: '', plainText: '' }

export function setInMemoryClipboardHTML(html: string, plainText = ''): void {
  memoryClipboard = { html, plainText }
}

export function getInMemoryClipboardHTML(matchingPlainText?: string): string {
  if (
    matchingPlainText !== undefined &&
    (memoryClipboard.plainText === '' || memoryClipboard.plainText !== matchingPlainText)
  ) {
    return ''
  }
  return memoryClipboard.html
}

export function hasInMemoryClipboardHTML(): boolean {
  return Boolean(memoryClipboard.html)
}

export function clearInMemoryClipboardHTML(): void {
  memoryClipboard = { html: '', plainText: '' }
}
