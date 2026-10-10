import type { ClipboardPayload } from '@/app/editor/clipboard/system/types'

let memoryClipboard: ClipboardPayload = { html: '', plainText: '' }

export function setInMemoryClipboardPayload(payload: ClipboardPayload): void {
  memoryClipboard = payload
}

/**
 * What identifies a copy: its Base64 metadata and buffer. Browsers rewrite clipboard HTML when
 * reading it back, changing quotes and escaping, but leave the Base64 alone.
 */
function clipboardPayloadKey(html: string): string | null {
  const meta = /\(figmeta\)(.*?)\(\/figmeta\)/.exec(html)?.[1]
  const buffer = /\(figma\)(.*?)\(\/figma\)/s.exec(html)?.[1]
  return meta && buffer ? `${meta}:${buffer}` : null
}

/** The snapshot of the last copy when `html` is that copy, however the clipboard rewrote it. */
export function matchingClipboardSnapshot(html: string) {
  const { snapshot } = memoryClipboard
  if (!html || !snapshot) return undefined
  if (html === memoryClipboard.html) return snapshot
  const key = clipboardPayloadKey(html)
  return key !== null && key === clipboardPayloadKey(memoryClipboard.html) ? snapshot : undefined
}

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
