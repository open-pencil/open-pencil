import { serializeHTML } from '../export/html'
import type {
  CSSComputeOptions,
  CSSRuntime,
  DesignDocument,
  DesignElement,
  DesignNode,
  DesignViewport
} from '../types'
import { recordLayout } from './layout'

export interface BrowserCSSRuntimeOptions {
  document?: Document
  sandbox?: 'shadow-root' | 'iframe'
}

const DEFAULT_COMPUTED_PROPERTIES = [
  'align-items',
  'aspect-ratio',
  'background-color',
  'background-image',
  'border-bottom-color',
  'border-bottom-style',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-bottom-width',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'border-radius',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-top-color',
  'border-top-style',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-top-width',
  'box-shadow',
  'box-sizing',
  'color',
  'column-gap',
  'display',
  'align-self',
  'bottom',
  'flex-direction',
  'flex-wrap',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'gap',
  'height',
  'justify-content',
  'letter-spacing',
  'left',
  'line-height',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'object-fit',
  'opacity',
  'overflow',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'position',
  'right',
  'row-gap',
  'text-align',
  'text-decoration-line',
  'text-shadow',
  'text-transform',
  'top',
  'transform',
  'transform-origin',
  'white-space',
  'width'
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

/**
 * How long layout waits for an image to load. An image without a size takes its own once loaded,
 * moving what follows it, but a request that never ends must not hold an import forever.
 */
const IMAGE_LOAD_LIMIT_MS = 10_000

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
    view.setTimeout(resolve, IMAGE_LOAD_LIMIT_MS)
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
    'contain: layout style paint'
  ].join(';')
}

async function computeStylesInShadowRoot(
  browserDocument: Document,
  designDocument: DesignDocument,
  cssText: string,
  options: CSSComputeOptions
): Promise<DesignDocument> {
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
    return copyComputedStyles(designDocument, content, options, {
      origin: content,
      styleRoot: shadow
    })
  } finally {
    host.remove()
  }
}

async function computeStylesInIframe(
  browserDocument: Document,
  designDocument: DesignDocument,
  cssText: string,
  options: CSSComputeOptions
): Promise<DesignDocument> {
  const iframe = browserDocument.createElement('iframe')
  applySandboxHostStyle(iframe, options.viewport)
  browserDocument.body.append(iframe)

  try {
    const iframeDocument = iframe.contentDocument
    if (!iframeDocument) throw new TypeError('Browser CSS runtime could not create iframe document')
    iframeDocument.open()
    iframeDocument.write(`<!doctype html><html><head></head><body></body></html>`)
    iframeDocument.close()

    const style = iframeDocument.createElement('style')
    style.textContent = cssText
    iframeDocument.head.append(style)

    // The document's top-level nodes go straight into the body, so `body` rules and selectors
    // such as `body > header` apply to them as they do on the page they came from.
    const content = iframeDocument.body
    content.innerHTML = serializeHTML(designDocument)

    await settle(iframeDocument, iframeDocument)
    return copyComputedStyles(designDocument, content, options, {
      origin: iframeDocument.documentElement,
      styleRoot: iframeDocument.head
    })
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

function copyComputedStyles(
  designDocument: DesignDocument,
  content: Element,
  options: CSSComputeOptions,
  frame: LayoutFrame
): DesignDocument {
  const view = content.ownerDocument.defaultView
  if (!view) throw new TypeError('Browser CSS runtime requires getComputedStyle')

  const nextDocument = structuredClone(designDocument)
  const pairs: [DesignElement, Element][] = []
  const domChildren = Array.from(content.childNodes)
  for (const [index, child] of nextDocument.children.entries()) {
    const domChild = domChildren.at(index)
    if (domChild) collectElementPairs(child, domChild, pairs)
  }

  for (const [designElement, domElement] of pairs) {
    designElement.computedStyle = computedStyleToRecord(view.getComputedStyle(domElement), options)
  }
  // After the styles are copied: reading layout switches transforms off for a moment.
  if (options.layout) recordLayout(pairs, frame.origin, frame.styleRoot)

  return nextDocument
}

export function createBrowserCSSRuntime(options: BrowserCSSRuntimeOptions = {}): CSSRuntime {
  const browserDocument = resolveBrowserDocument(options.document)
  const sandbox = options.sandbox ?? 'shadow-root'

  return {
    kind: 'browser',
    parseHTML: (html) => parseHTMLWithDocument(browserDocument, html),
    serializeHTML,
    computeStyles: (designDocument, cssText = '', computeOptions = {}) =>
      sandbox === 'iframe'
        ? computeStylesInIframe(browserDocument, designDocument, cssText, computeOptions)
        : computeStylesInShadowRoot(browserDocument, designDocument, cssText, computeOptions)
  }
}
