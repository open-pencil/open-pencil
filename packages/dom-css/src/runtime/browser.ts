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
import { attachImages, backgroundImageURLs, canvasBackground, fontFaceRules } from './resources'

export interface BrowserCSSRuntimeOptions {
  document?: Document
  /**
   * The address the page came from, which its relative stylesheets, images, and fonts resolve
   * against, as on the page itself.
   */
  baseURL?: string
  /**
   * Reads the pictures the page's images show, which go with their elements. The measuring frame
   * has loaded them, but a picture from another site cannot be read back from it.
   */
  fetch?: DesignResourceFetch
}

/**
 * Styled elements, each `<img>` with the address the frame loaded its picture from, and the
 * elements whose backgrounds show pictures.
 */
interface CopiedStyles {
  document: DesignDocument
  images: [DesignElement, string][]
  backgrounds: DesignElement[]
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
  'isolation',
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

/**
 * How long layout waits for fonts and images to load. An image without a size takes its own once
 * loaded, moving what follows it, but a request that never ends must not hold an import forever.
 */
const LOAD_LIMIT_MS = DEADLINE_MS.request

/**
 * How long a page's linked stylesheets may take to load before it is laid out without the rest:
 * a page may link several, each its own request, so they share a slow request's bound.
 */
const STYLESHEET_LIMIT_MS = DEADLINE_MS.slowRequest

function nextFrame(view: Window): Promise<void> {
  return new Promise((resolve) => {
    view.requestAnimationFrame(() => resolve())
  })
}

/** Resolves once `loaded()` holds, looked at each frame of `view`, or `limit` passes. */
async function untilLoaded(
  view: Window,
  loaded: () => boolean,
  limit = LOAD_LIMIT_MS
): Promise<void> {
  const deadline = view.performance.now() + limit
  while (!loaded() && view.performance.now() < deadline) await nextFrame(view)
}

/** Whether no font is still loading. Laying text out is what starts its fonts loading. */
function fontsLoaded(frame: Document): boolean {
  frame.documentElement.getBoundingClientRect()
  return frame.fonts.status !== 'loading'
}

/**
 * Whether every sheet a stylesheet imports, and every sheet those import, has loaded or failed:
 * an `@import` rule's sheet stays null until then, in Chromium and WebKit alike. A sheet from
 * another site cannot be looked into, so what it imports is not waited for.
 */
function importsLoaded(sheet: CSSStyleSheet): boolean {
  let rules: CSSRuleList
  try {
    rules = sheet.cssRules
  } catch {
    return true
  }
  for (const rule of Array.from(rules)) {
    if (!('styleSheet' in rule && 'href' in rule)) continue
    const imported = (rule as CSSImportRule).styleSheet
    if (!imported || !importsLoaded(imported)) return false
  }
  return true
}

/**
 * Waits until the frame's web fonts and images have loaded and a frame has laid it out with
 * them, so lines break and boxes size as the page shows them, not in a fallback font or around
 * an image that has not arrived. The frame runs no script, and WebKit then fires no timer,
 * animation frame, or listener in it, whoever set them: `host`, the window of the document that
 * owns the frame, keeps the time and reads the frame's state instead.
 */
async function settle(host: Window, frame: Document): Promise<void> {
  await nextFrame(host)
  await untilLoaded(host, () => fontsLoaded(frame))
  const images = Array.from(frame.querySelectorAll('img'))
  // A lazy image outside the frame's view would never load, so every image loads now.
  for (const image of images) {
    if (image.getAttribute('loading') === 'lazy') image.setAttribute('loading', 'eager')
  }
  await untilLoaded(host, () => images.every((image) => image.complete))
  await nextFrame(host)
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

/**
 * What the measuring frame may do. Its content is markup and CSS from a file, the clipboard, a web
 * page, or a code editor, laid out only to be measured: without `allow-scripts` the browser runs
 * no script element, event handler attribute, or `javascript:` URL in the frame or in a frame
 * nested in it. `allow-same-origin` keeps its document readable from this one, and gives the
 * content nothing while it cannot run.
 */
const MEASURING_FRAME_SANDBOX = 'allow-same-origin'

/**
 * The frame's own policy says the same a second way, and keeps nested frames and plugins from
 * loading documents nothing measures. Images, fonts, and stylesheets still load: layout needs them.
 */
const MEASURING_FRAME_POLICY = "script-src 'none'; frame-src 'none'; object-src 'none'"

const MEASURING_FRAME_DOCUMENT = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${MEASURING_FRAME_POLICY}"></head><body></body></html>`

async function computeStylesInFrame(
  browserDocument: Document,
  designDocument: DesignDocument,
  cssText: string,
  options: CSSComputeOptions,
  baseURL: string | undefined
): Promise<CopiedStyles> {
  const host = browserDocument.defaultView
  if (!host) throw new TypeError('Browser CSS runtime requires a document shown in a window')
  const iframe = browserDocument.createElement('iframe')
  // Before the frame joins the document, since its sandbox is fixed once its document exists.
  iframe.setAttribute('sandbox', MEASURING_FRAME_SANDBOX)
  applySandboxHostStyle(iframe, options.viewport)
  browserDocument.body.append(iframe)

  try {
    const iframeDocument = iframe.contentDocument
    if (!iframeDocument) throw new TypeError('Browser CSS runtime could not create iframe document')
    iframeDocument.open()
    iframeDocument.write(MEASURING_FRAME_DOCUMENT)
    iframeDocument.close()
    if (baseURL) {
      const base = iframeDocument.createElement('base')
      base.href = baseURL
      iframeDocument.head.append(base)
    }

    const style = iframeDocument.createElement('style')
    style.textContent = cssText
    iframeDocument.head.append(style)
    // The sheets it imports, such as a page's linked stylesheets, apply once they load.
    const { sheet } = style
    if (sheet) await untilLoaded(host, () => importsLoaded(sheet), STYLESHEET_LIMIT_MS)

    // The document's top-level nodes go straight into the body, so `body` rules and selectors
    // such as `body > header` apply to them as they do on the page they came from.
    const content = iframeDocument.body
    content.innerHTML = serializeHTML(designDocument)

    await settle(host, iframeDocument)
    const copied = await copyComputedStyles(host, designDocument, content, options, {
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
  host: Window,
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
    const frameDocument = content.ownerDocument
    await nextFrame(host)
    await untilLoaded(host, () => fontsLoaded(frameDocument))
  }

  const images: [DesignElement, string][] = []
  const backgrounds: DesignElement[] = []
  for (const [designElement, domElement] of pairs) {
    const style = computedStyleToRecord(view.getComputedStyle(domElement), options)
    keepAutoSideMargins(domElement, style)
    designElement.computedStyle = style
    // The address the picture loaded from, its `srcset` choice and the page's base applied.
    if (domElement instanceof view.HTMLImageElement && domElement.currentSrc)
      images.push([designElement, domElement.currentSrc])
    if (backgroundImageURLs(designElement).length > 0) backgrounds.push(designElement)
  }
  // After the styles are copied: reading layout switches transforms off for a moment.
  if (options.layout) recordLayout(pairs, frame.origin, frame.styleRoot)
  showFormText(pairs, view, (style) => computedStyleToRecord(style, options))

  return { document: nextDocument, images, backgrounds }
}

/**
 * Parses and styles markup with the browser's own engine. The markup is untrusted: it is parsed
 * in a document that runs nothing and laid out in a frame that runs no script, so opening,
 * pasting, or previewing HTML never executes it.
 */
export function createBrowserCSSRuntime(options: BrowserCSSRuntimeOptions = {}): CSSRuntime {
  const browserDocument = resolveBrowserDocument(options.document)

  return {
    kind: 'browser',
    parseHTML: (html) => parseHTMLWithDocument(browserDocument, html),
    serializeHTML,
    async computeStyles(designDocument, cssText = '', computeOptions = {}) {
      const copied = await computeStylesInFrame(
        browserDocument,
        designDocument,
        cssText,
        computeOptions,
        options.baseURL
      )
      await attachImages(copied.images, options.fetch, copied.backgrounds)
      if (options.fetch) {
        copied.document.fontFaces = await fontFaceRules(cssText, options.baseURL, options.fetch)
      }
      return copied.document
    }
  }
}
