import { delay } from 'es-toolkit'

import { DEADLINE_MS } from '@open-pencil/std/timing'

import { serializeHTML } from '../export/html'
import type {
  CSSComputeOptions,
  CSSRuntime,
  DesignDocument,
  DesignElement,
  DesignNode,
  DesignResourceFetch,
  DesignViewport
} from '../types'
import { showFormText } from './form-text'
import { showGeneratedContent } from './generated'
import { recordLayout } from './layout'
import { attachImages, canvasBackground, fontFaceRules, RESOURCE_TIMEOUT_MS } from './resources'

export interface BrowserCSSRuntimeOptions {
  document?: Document
  sandbox?: 'shadow-root' | 'iframe'
  /**
   * The address the page came from, which its relative stylesheets, images, and fonts resolve
   * against, as on the page itself. Only the iframe sandbox has a base of its own.
   */
  baseURL?: string
  /**
   * Reads the pictures the page's images show, which go with their elements. The sandbox has
   * loaded them, but a picture from another site cannot be read back from it.
   */
  fetch?: DesignResourceFetch
}

/** Styled elements, and each `<img>` with the address the sandbox loaded its picture from. */
interface CopiedStyles {
  document: DesignDocument
  images: [DesignElement, string][]
}

/**
 * The computed properties the importer reads, the same the HTML engine reports, so a page imports
 * alike whichever runtime styles it.
 */
const DEFAULT_COMPUTED_PROPERTIES = [
  'align-content',
  'align-items',
  'align-self',
  'aspect-ratio',
  'backdrop-filter',
  'background-clip',
  'background-color',
  'background-image',
  'background-position',
  'background-repeat',
  'background-size',
  'border-bottom-color',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-bottom-style',
  'border-bottom-width',
  'border-collapse',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'border-radius',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-spacing',
  'border-top-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-top-style',
  'border-top-width',
  'bottom',
  'box-shadow',
  'box-sizing',
  'caption-side',
  'clip-path',
  'color',
  'column-gap',
  'content',
  'display',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'flex-basis',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'font-family',
  'font-size',
  'font-stretch',
  'font-style',
  'font-weight',
  'gap',
  'grid-column-end',
  'grid-column-start',
  'grid-row-end',
  'grid-row-start',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'justify-content',
  'justify-items',
  'justify-self',
  'left',
  'letter-spacing',
  'line-height',
  'list-style-type',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'mask-image',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'mix-blend-mode',
  'object-fit',
  'object-position',
  'opacity',
  'outline-color',
  'outline-offset',
  'outline-style',
  'outline-width',
  'overflow',
  'overflow-x',
  'overflow-y',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'position',
  'right',
  'rotate',
  'row-gap',
  'scale',
  'stroke',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'text-align',
  'text-anchor',
  'text-decoration-color',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-thickness',
  'text-indent',
  'text-overflow',
  'text-shadow',
  'text-transform',
  'text-underline-offset',
  'text-wrap-mode',
  'top',
  'transform',
  'transform-origin',
  'translate',
  'vertical-align',
  'visibility',
  'white-space',
  'width',
  'word-spacing',
  'z-index'
] as const

function resolveBrowserDocument(documentOverride: Document | undefined): Document {
  if (documentOverride) return documentOverride
  if (typeof document === 'undefined') {
    throw new TypeError('Browser CSS runtime requires a DOM document')
  }
  return document
}

function attributesToRecord(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const attr of Array.from(element.attributes)) {
    attrs[attr.name] = attr.value
  }
  return attrs
}

function styleToRecord(style: CSSStyleDeclaration): Record<string, string> | undefined {
  const entries: Record<string, string> = {}
  for (const property of Array.from(style)) {
    const value = style.getPropertyValue(property)
    if (value) entries[property] = value
  }
  return Object.keys(entries).length > 0 ? entries : undefined
}

const NON_RENDERED_TAGS = new Set(['head', 'link', 'meta', 'script', 'style', 'template', 'title'])

function domNodeToDesignNode(node: Node): DesignNode | null {
  if (node.nodeType === 3) {
    const text = node.textContent ?? ''
    return text.length > 0 ? { type: 'text', text } : null
  }

  if (node.nodeType !== 1) return null

  const element = node as Element
  if (NON_RENDERED_TAGS.has(element.tagName.toLowerCase())) return null
  const children = Array.from(element.childNodes)
    .map(domNodeToDesignNode)
    .filter((child): child is DesignNode => child !== null)
  const style = 'style' in element ? (element.style as CSSStyleDeclaration) : undefined

  return {
    type: 'element',
    tagName: element.tagName.toLowerCase(),
    attrs: attributesToRecord(element),
    children,
    inlineStyle: style ? styleToRecord(style) : undefined
  }
}

function parseHTMLWithDocument(browserDocument: Document, html: string): DesignDocument {
  const Parser = browserDocument.defaultView?.DOMParser
  if (!Parser) throw new TypeError('Browser CSS runtime requires DOMParser')
  const parser = new Parser()
  const parsed = parser.parseFromString(html, 'text/html')
  return {
    type: 'document',
    children: Array.from(parsed.body.childNodes)
      .map(domNodeToDesignNode)
      .filter((node): node is DesignNode => node !== null)
  }
}

function collectElementPairs(
  designNode: DesignNode,
  domNode: Node,
  pairs: [DesignElement, Element][]
): void {
  if (designNode.type === 'text') return
  const view = domNode.ownerDocument?.defaultView
  if (!view || !(domNode instanceof view.Element)) return

  pairs.push([designNode, domNode])

  const elementChildren = designNode.children.filter(
    (child): child is DesignElement => child.type === 'element'
  )
  const domChildren = Array.from(domNode.children)
  for (const [index, child] of elementChildren.entries()) {
    const domChild = domChildren.at(index)
    if (domChild) collectElementPairs(child, domChild, pairs)
  }
}

function computedStyleToRecord(
  style: CSSStyleDeclaration,
  options: CSSComputeOptions
): Record<string, string> {
  const entries: Record<string, string> = {}
  const properties = options.includeBrowserDefaults
    ? Array.from(style)
    : DEFAULT_COMPUTED_PROPERTIES

  for (const property of properties) {
    const value = style.getPropertyValue(property)
    if (value) entries[property] = value
  }

  return entries
}

const SIDE_MARGINS = ['margin-left', 'margin-right'] as const

/**
 * Gives `auto` side margins as `auto`: `getComputedStyle` reports the length layout resolved them
 * to, which loses that they center or end-align the block. Their computed value says so where the
 * browser has CSS Typed OM; elsewhere the lengths stay.
 */
function keepAutoSideMargins(element: Element, style: Record<string, string>): void {
  if (!('computedStyleMap' in element)) return
  const computed = element.computedStyleMap()
  for (const side of SIDE_MARGINS) {
    if (computed.get(side)?.toString() === 'auto') style[side] = 'auto'
  }
}

/** Resolves once every image under `root` has loaded or failed, or the time limit passes. */
function imagesLoaded(root: ParentNode, view: Window): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  // A lazy image outside the sandbox's view would never load, so every image loads now.
  for (const image of images) {
    if (image.getAttribute('loading') === 'lazy') image.setAttribute('loading', 'eager')
  }
  const pending = images.filter((image) => !image.complete)
  if (pending.length === 0) return Promise.resolve()
  const loaded = Promise.all(
    pending.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => resolve(), { once: true })
        })
    )
  ).then(() => undefined)
  const limit = new Promise<void>((resolve) => {
    view.setTimeout(resolve, RESOURCE_TIMEOUT_MS)
  })
  return Promise.race([loaded, limit])
}

/**
 * Waits until the document's web fonts and the content's images have loaded and a frame has laid
 * it out with them, so lines break and boxes size as the page shows them, not in a fallback font
 * or around an image that has not arrived.
 */
async function settle(browserDocument: Document, content: ParentNode): Promise<void> {
  await requestFrame(browserDocument)
  await browserDocument.fonts.ready
  const view = browserDocument.defaultView
  if (view) await imagesLoaded(content, view)
  await requestFrame(browserDocument)
}

function requestFrame(browserDocument: Document): Promise<void> {
  const requestAnimationFrame = browserDocument.defaultView?.requestAnimationFrame
  if (!requestAnimationFrame) return Promise.resolve()
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

const DEFAULT_SANDBOX_WIDTH = 1000

function applySandboxHostStyle(element: HTMLElement, viewport: DesignViewport | undefined): void {
  element.style.cssText = [
    'position: fixed',
    'left: -100000px',
    'top: 0',
    `width: ${viewport?.width ?? DEFAULT_SANDBOX_WIDTH}px`,
    viewport ? `height: ${viewport.height}px` : 'height: auto',
    'border: 0',
    'visibility: hidden',
    'pointer-events: none',
    'contain: layout style paint',
    // A page is styled as in a light browser whatever the app's theme: an iframe's
    // `prefers-color-scheme` follows its element's color scheme, and the HTML engine is light too.
    'color-scheme: light'
  ].join(';')
}

async function computeStylesInShadowRoot(
  browserDocument: Document,
  designDocument: DesignDocument,
  cssText: string,
  options: CSSComputeOptions
): Promise<CopiedStyles> {
  const host = browserDocument.createElement('div')
  applySandboxHostStyle(host, options.viewport)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = browserDocument.createElement('style')
  style.textContent = cssText
  shadow.append(style)

  const content = browserDocument.createElement('div')
  content.innerHTML = serializeHTML(designDocument)
  shadow.append(content)
  browserDocument.body.append(host)

  try {
    await settle(browserDocument, shadow)
    return await copyComputedStyles(designDocument, content, options, {
      origin: content,
      styleRoot: shadow
    })
  } finally {
    host.remove()
  }
}

/**
 * How long a page's linked stylesheets may take to load before it is laid out without the rest:
 * a page may link several, each its own request, so they share a slow request's bound.
 */
const STYLESHEET_WAIT_MS = DEADLINE_MS.slowRequest

/**
 * Resolves once a `<style>` element's imported sheets have loaded or failed, which its `load` and
 * `error` events tell, or after `STYLESHEET_WAIT_MS`, so a server that never finishes sending a
 * sheet does not hold the import open. A sheet that imports nothing fires `load` at once.
 */
function stylesheetLoaded(style: HTMLStyleElement): Promise<void> {
  const settled = new Promise<void>((resolve) => {
    style.addEventListener('load', () => resolve(), { once: true })
    style.addEventListener('error', () => resolve(), { once: true })
  })
  return Promise.race([settled, delay(STYLESHEET_WAIT_MS)])
}

async function computeStylesInIframe(
  browserDocument: Document,
  designDocument: DesignDocument,
  cssText: string,
  options: CSSComputeOptions,
  baseURL: string | undefined
): Promise<CopiedStyles> {
  const iframe = browserDocument.createElement('iframe')
  applySandboxHostStyle(iframe, options.viewport)
  browserDocument.body.append(iframe)

  try {
    const iframeDocument = iframe.contentDocument
    if (!iframeDocument) throw new TypeError('Browser CSS runtime could not create iframe document')
    iframeDocument.open()
    iframeDocument.write(`<!doctype html><html><head></head><body></body></html>`)
    iframeDocument.close()
    if (baseURL) {
      const base = iframeDocument.createElement('base')
      base.href = baseURL
      iframeDocument.head.append(base)
    }

    const style = iframeDocument.createElement('style')
    const loaded = stylesheetLoaded(style)
    style.textContent = cssText
    iframeDocument.head.append(style)
    // The sheets it imports, such as a page's linked stylesheets, apply once they load.
    await loaded

    // The document's top-level nodes go straight into the body, so `body` rules and selectors
    // such as `body > header` apply to them as they do on the page they came from.
    const content = iframeDocument.body
    content.innerHTML = serializeHTML(designDocument)

    await settle(iframeDocument, iframeDocument)
    const copied = await copyComputedStyles(designDocument, content, options, {
      origin: iframeDocument.documentElement,
      styleRoot: iframeDocument.head
    })
    copied.document.background = canvasBackground(iframeDocument)
    return copied
  } finally {
    iframe.remove()
  }
}

interface LayoutFrame {
  /** The element whose top-left the recorded boxes are relative to. */
  origin: Element
  /** Where the stylesheet that switches transforms off goes while boxes are read. */
  styleRoot: Node & ParentNode
}

async function copyComputedStyles(
  designDocument: DesignDocument,
  content: Element,
  options: CSSComputeOptions,
  frame: LayoutFrame
): Promise<CopiedStyles> {
  const view = content.ownerDocument.defaultView
  if (!view) throw new TypeError('Browser CSS runtime requires getComputedStyle')

  const nextDocument = structuredClone(designDocument)
  const pairs: [DesignElement, Element][] = []
  // Elements pair by their order among elements, as they do further down: text nodes do not
  // line up, since text either side of a dropped element, such as a <script>, is two nodes here and
  // one once written into the sandbox.
  const elements = nextDocument.children.filter(
    (child): child is DesignElement => child.type === 'element'
  )
  const domElements = Array.from(content.children)
  for (const [index, child] of elements.entries()) {
    const domChild = domElements.at(index)
    if (domChild) collectElementPairs(child, domChild, pairs)
  }

  // Generated content becomes elements, laid out before anything is read.
  if (showGeneratedContent(pairs, view, frame.styleRoot, content) > 0) {
    await requestFrame(content.ownerDocument)
    await content.ownerDocument.fonts.ready
  }

  const images: [DesignElement, string][] = []
  for (const [designElement, domElement] of pairs) {
    const style = computedStyleToRecord(view.getComputedStyle(domElement), options)
    keepAutoSideMargins(domElement, style)
    designElement.computedStyle = style
    // The address the picture loaded from, its `srcset` choice and the page's base applied.
    if (domElement instanceof view.HTMLImageElement && domElement.currentSrc)
      images.push([designElement, domElement.currentSrc])
  }
  // After the styles are copied: reading layout switches transforms off for a moment.
  if (options.layout) recordLayout(pairs, frame.origin, frame.styleRoot)
  showFormText(pairs, view, (style) => computedStyleToRecord(style, options))

  return { document: nextDocument, images }
}

export function createBrowserCSSRuntime(options: BrowserCSSRuntimeOptions = {}): CSSRuntime {
  const browserDocument = resolveBrowserDocument(options.document)
  const sandbox = options.sandbox ?? 'shadow-root'

  return {
    kind: 'browser',
    parseHTML: (html) => parseHTMLWithDocument(browserDocument, html),
    serializeHTML,
    async computeStyles(designDocument, cssText = '', computeOptions = {}) {
      const copied =
        sandbox === 'iframe'
          ? await computeStylesInIframe(
              browserDocument,
              designDocument,
              cssText,
              computeOptions,
              options.baseURL
            )
          : await computeStylesInShadowRoot(
              browserDocument,
              designDocument,
              cssText,
              computeOptions
            )
      await attachImages(copied.images, options.fetch)
      if (options.fetch) {
        copied.document.fontFaces = await fontFaceRules(cssText, options.baseURL, options.fetch)
      }
      return copied.document
    }
  }
}
