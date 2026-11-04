import type { Editor, PastedTextLink } from '@open-pencil/core'
import { browserHTMLHasBoxes, browserHTMLToDesignDocument } from '@open-pencil/dom-css/browser'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { filesMessages, menuMessages } from '@open-pencil/vue/i18n'

import { toast } from '@/app/shell/ui'
import { HTML_IMPORT_VIEWPORT } from '@/constants'

import { isDesignClipboardHTML } from '../html'
import { rememberWebClipboard } from '../memory'
import { readWebClipboard } from '../read'
import { pasteClipboardHTML, pastePoint } from './content'

/** What a copy from outside OpenPencil holds: its text and, from a web page, its HTML. */
export interface WebClipboard {
  html: string
  text: string
}

/** The undo entry Core records for a text paste, which Paste as layers takes back. */
const PASTE_TEXT_LABEL = 'Paste text'

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function linkURL(href: string): string | null {
  try {
    return LINK_PROTOCOLS.has(new URL(href).protocol) ? href : null
  } catch {
    return null
  }
}

function parseHTML(markup: string): Document {
  return new DOMParser().parseFromString(markup, 'text/html')
}

/**
 * Whether copied text is HTML source, as copied from an editor: it starts with a tag and parses
 * to elements. Its own HTML then is the editor's highlighted rendering, not the markup.
 */
export function isHTMLMarkup(text: string): boolean {
  const trimmed = text.trimStart()
  if (!/^<[a-zA-Z!]/.test(trimmed)) return false
  return parseHTML(trimmed).body.children.length > 0
}

/**
 * The HTML that Paste as layers lays out: copied HTML source as written, else what a web page
 * put on the clipboard. Null when the copy holds neither.
 */
export function layerMarkup({ html, text }: WebClipboard): string | null {
  if (isHTMLMarkup(text)) return text
  return html.trim().length > 0 ? html : null
}

/**
 * The copied text with the links its page had: each `<a href>`'s words, found in the text in
 * the order the page has them, as Figma keeps them on paste.
 */
export function pastedText({ html, text }: WebClipboard): {
  text: string
  links: PastedTextLink[]
} {
  const document = html ? parseHTML(html) : null
  const plain = text.length > 0 ? text : (document?.body.textContent ?? '')
  const links: PastedTextLink[] = []
  if (!document || isHTMLMarkup(text)) return { text: plain, links }
  let from = 0
  for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
    const words = anchor.textContent.replace(/\s+/g, ' ').trim()
    const url = linkURL(anchor.getAttribute('href') ?? '')
    if (!words || !url) continue
    const start = plain.indexOf(words, from)
    if (start === -1) continue
    links.push({ start, length: words.length, url })
    from = start + words.length
  }
  return { text: plain, links }
}

/**
 * Whether pasting as text should offer layers: the copy is HTML source, or its HTML lays boxes
 * out. A sentence copied from a page or a document carries text styling only, so it does not.
 */
export function offersLayers(clipboard: WebClipboard): boolean {
  return (
    isHTMLMarkup(clipboard.text) || (clipboard.html !== '' && browserHTMLHasBoxes(clipboard.html))
  )
}

/**
 * Lays HTML out as a browser would, at the width of the frame it goes into or the import
 * viewport on the canvas, and pastes the layers centred on the point.
 */
export async function pasteHTMLAsLayers(
  editor: Editor,
  markup: string,
  cursorPos?: Vector
): Promise<boolean> {
  const { x, y } = pastePoint(editor, cursorPos)
  const width = editor.htmlPasteWidth() ?? HTML_IMPORT_VIEWPORT.width
  try {
    const styled = await browserHTMLToDesignDocument(markup, {
      compute: { layout: true, viewport: { width, height: HTML_IMPORT_VIEWPORT.height } }
    })
    return await editor.pasteStyledHTML(styled, x, y)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    toast.error(filesMessages.get().htmlPasteFailed({ error: reason }))
    return true
  }
}

/**
 * Pastes a copy from outside OpenPencil as text, as Figma does. When its HTML lays boxes out, a
 * notice offers to paste it as layers instead, taking the text back first.
 */
export async function pasteWebClipboard(
  editor: Editor,
  clipboard: WebClipboard,
  cursorPos?: Vector
): Promise<boolean> {
  const { text, links } = pastedText(clipboard)
  const { x, y } = pastePoint(editor, cursorPos)
  rememberWebClipboard(clipboard.html, clipboard.text)
  const pastedId = await editor.pasteText(text, x, y, links)
  const markup = layerMarkup(clipboard)
  if (!pastedId || !markup || !offersLayers(clipboard)) return pastedId !== null
  toast.info(filesMessages.get().pastedAsText, {
    label: menuMessages.get().pasteAsLayers,
    run: (toastId) => {
      toast.remove(toastId)
      // Only the paste this notice is about is taken back, while it is still the last edit.
      const selected = editor.state.selectedIds
      const isLastPaste =
        editor.undo.undoLabel === PASTE_TEXT_LABEL && selected.size === 1 && selected.has(pastedId)
      if (isLastPaste) editor.undoAction()
      void pasteHTMLAsLayers(editor, markup, { x, y })
    }
  })
  return true
}

/**
 * Paste as layers: lays the clipboard's HTML out as layers, as HTML import does. Layers copied
 * here or from Figma paste as they always do, and a clipboard without HTML says so.
 */
export async function pasteClipboardAsLayers(editor: Editor, cursorPos?: Vector): Promise<void> {
  const clipboard = await readWebClipboard()
  if (isDesignClipboardHTML(clipboard.html)) {
    await pasteClipboardHTML(editor, clipboard.html, cursorPos)
    return
  }
  const markup = layerMarkup(clipboard)
  if (!markup) {
    toast.info(filesMessages.get().noHTMLToPasteAsLayers)
    return
  }
  await pasteHTMLAsLayers(editor, markup, cursorPos)
}
