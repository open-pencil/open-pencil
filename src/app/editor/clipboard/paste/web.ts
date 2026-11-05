import { escapeRegExp } from 'es-toolkit'

import type { ClipboardSnapshot, Editor, PastedTextLink } from '@open-pencil/core'
import { HTML_IMPORT_VIEWPORT } from '@open-pencil/core/io/formats/html/layers'
import { browserHTMLHasBoxes, browserHTMLToDesignDocument } from '@open-pencil/dom-css/browser'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { filesMessages, menuMessages } from '@open-pencil/vue/i18n'

import { toast } from '@/app/shell/ui'

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

function collapseSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The words, matched across any run of whitespace, as the page's text and its plain text differ. */
function wordsPattern(words: string): RegExp {
  return new RegExp(words.split(' ').map(escapeRegExp).join('\\s+'), 'g')
}

/** Elements whose text the page does not show, so it is not in the copied plain text. */
const UNSHOWN_TAGS = new Set(['head', 'noscript', 'script', 'style', 'template', 'title'])

function isUnshown(element: Element): boolean {
  if (UNSHOWN_TAGS.has(element.tagName.toLowerCase()) || element.hasAttribute('hidden')) return true
  return element instanceof HTMLElement && element.style.display === 'none'
}

/**
 * The page's links, each with the shown text before it: what the copied plain text holds of the
 * page, as hidden elements and scripts leave nothing there.
 */
function linksWithShownText(document: Document): { anchor: Element; before: string }[] {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node instanceof Element && isUnshown(node)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
    }
  )
  const links: { anchor: Element; before: string }[] = []
  let shown = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element) {
      if (node.matches('a[href]')) links.push({ anchor: node, before: shown })
    } else {
      shown += node.textContent ?? ''
    }
  }
  return links
}

/**
 * The copied text with the links its page had, as Figma keeps them on paste. Each `<a href>` is
 * found as the same occurrence of its words in the text as in the shown text of the page, so a
 * repeated word links where the page linked it and a line break inside the link does not lose
 * it. Like Figma, only the copied plain text is pasted; a copy of HTML alone pastes no text.
 */
export function pastedText({ html, text }: WebClipboard): {
  text: string
  links: PastedTextLink[]
} {
  const links: PastedTextLink[] = []
  if (!html || text.length === 0 || isHTMLMarkup(text)) return { text, links }
  // The plain text is scanned once for each link text, however many links share it.
  const matches = new Map<string, RegExpExecArray[]>()
  const matchesOf = (words: string) => {
    let found = matches.get(words)
    if (!found) {
      found = [...text.matchAll(wordsPattern(words))]
      matches.set(words, found)
    }
    return found
  }
  for (const { anchor, before } of linksWithShownText(parseHTML(html))) {
    const words = collapseSpace(anchor.textContent)
    const url = linkURL(anchor.getAttribute('href') ?? '')
    if (!words || !url) continue
    const occurrence = collapseSpace(before).match(wordsPattern(words))?.length ?? 0
    const match = matchesOf(words).at(occurrence)
    if (match?.index !== undefined) links.push({ start: match.index, length: match[0].length, url })
  }
  return { text, links }
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
 * The layers HTML makes, laid out as a browser would at the width of the frame they go into, or
 * the import viewport on the canvas. The destination is read before layout and again after it,
 * and the HTML laid out again until neither it nor its width changed meanwhile.
 */
async function prepareLayers(editor: Editor, markup: string): Promise<ClipboardSnapshot | null> {
  // Each further pass needs the destination to change again while the HTML is laid out.
  for (;;) {
    const target = editor.htmlPasteTarget()
    const width = target.width ?? HTML_IMPORT_VIEWPORT.width
    const styled = await browserHTMLToDesignDocument(markup, {
      compute: { layout: true, viewport: { width, height: HTML_IMPORT_VIEWPORT.height } }
    })
    const snapshot = await editor.prepareStyledHTML(styled)
    const now = editor.htmlPasteTarget()
    if (now.id === target.id && now.width === target.width) return snapshot
  }
}

/**
 * Pastes HTML as layers centred on the point. The layers are built first, so `beforePaste`, which
 * the notice uses to take its text back, runs only once there is something to paste instead.
 */
export async function pasteHTMLAsLayers(
  editor: Editor,
  markup: string,
  cursorPos?: Vector,
  beforePaste?: () => void
): Promise<boolean> {
  const point = pastePoint(editor, cursorPos)
  let snapshot: ClipboardSnapshot | null
  try {
    snapshot = await prepareLayers(editor, markup)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    toast.error(filesMessages.get().htmlPasteFailed({ error: reason }))
    return true
  }
  if (!snapshot) {
    toast.info(filesMessages.get().htmlPasteEmpty)
    return true
  }
  beforePaste?.()
  await editor.pasteSnapshot(snapshot, point)
  return true
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
  const markup = layerMarkup(clipboard)
  const offered = markup !== null && offersLayers(clipboard)
  // A laid-out copy without text, such as an empty card, has nothing to paste but its layers.
  if (text.trim().length === 0) {
    return offered && markup ? pasteHTMLAsLayers(editor, markup, { x, y }) : false
  }
  const pastedId = await editor.pasteText(text, x, y, links)
  if (!pastedId || !markup || !offered) return pastedId !== null
  // Only the paste this notice is about is taken back, while it is still the last edit.
  const takeBackText = () => {
    const selected = editor.state.selectedIds
    const isLastPaste =
      editor.undo.undoLabel === PASTE_TEXT_LABEL && selected.size === 1 && selected.has(pastedId)
    if (isLastPaste) editor.undoAction()
  }
  toast.info(filesMessages.get().pastedAsText, {
    label: menuMessages.get().pasteAsLayers,
    run: (toastId) => {
      toast.remove(toastId)
      void pasteHTMLAsLayers(editor, markup, { x, y }, takeBackText)
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
