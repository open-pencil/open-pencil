import { figmaClipboardPayload } from '@open-pencil/fig/clipboard'

import type { ClipboardPayload } from '@/app/editor/clipboard/system/types'

let memoryClipboard: ClipboardPayload = { html: '', plainText: '' }
let lastWebClipboard = { html: '', text: '' }

/** A copy made here replaces the page on the clipboard, even when its text is the same. */
function forgetWebClipboard(): void {
  lastWebClipboard = { html: '', text: '' }
}

export function setInMemoryClipboardPayload(payload: ClipboardPayload): void {
  memoryClipboard = payload
  forgetWebClipboard()
}

/**
 * What identifies a copy: its Base64 metadata and buffer. Browsers rewrite clipboard HTML when
 * reading it back, changing quotes and escaping, but leave the Base64 alone.
 */
function clipboardPayloadKey(html: string): string | null {
  const payload = figmaClipboardPayload(html)
  return payload ? `${payload.meta}:${payload.buffer}` : null
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
  forgetWebClipboard()
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
  forgetWebClipboard()
}

/**
 * Keeps the HTML of the last web page pasted here. The desktop clipboard plugin reads text only,
 * so Paste as layers takes this HTML while the clipboard still holds the same text.
 */
export function rememberWebClipboard(html: string, text: string): void {
  lastWebClipboard = { html, text }
}

/** The remembered web page HTML when the clipboard still holds its text; empty otherwise. */
export function rememberedWebHTML(text: string): string {
  return text !== '' && text === lastWebClipboard.text ? lastWebClipboard.html : ''
}
