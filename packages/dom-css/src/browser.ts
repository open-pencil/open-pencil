import { compact } from 'es-toolkit'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { laysOutBoxes } from './import/boxes'
import { mergeCSSText } from './import/css-text'
import { jsxToDesignDocumentCore, type JSXChild } from './import/jsx/core'
import { linkedStylesheet, stylesheetImportRules } from './import/linked-stylesheets'
import { designDocumentToSceneGraph, type ToSceneGraphOptions } from './import/scene-graph'
import type { CompileTailwindCSSOptions } from './import/tailwind'
import { createBrowserCSSRuntime, type BrowserCSSRuntimeOptions } from './runtime/browser'
import type { CSSComputeOptions, DesignDocument } from './types'

export { Fragment, jsx, jsxs } from './import/jsx/core'
export type { JSXChild, JSXElementProps, JSXStyleInput, JSXTag } from './import/jsx/core'

export interface BrowserToDesignDocumentOptions extends BrowserCSSRuntimeOptions {
  cssText?: string
  /**
   * Applies the page's `<link rel="stylesheet">` sheets, resolved against `baseURL`, ahead of
   * its own CSS, as a page fetched from its address needs.
   */
  importLinkedStylesheets?: boolean
  compute?: CSSComputeOptions
  signal?: AbortSignal
}

export type BrowserHTMLToDesignDocumentOptions = BrowserToDesignDocumentOptions

export interface BrowserHTMLToSceneGraphOptions
  extends BrowserToDesignDocumentOptions, ToSceneGraphOptions {}

export interface BrowserTailwindHTMLToDesignDocumentOptions
  extends Omit<BrowserHTMLToDesignDocumentOptions, 'cssText'>, CompileTailwindCSSOptions {}

export interface BrowserTailwindHTMLToSceneGraphOptions
  extends BrowserTailwindHTMLToDesignDocumentOptions, ToSceneGraphOptions {}

export interface BrowserToSceneGraphOptions
  extends BrowserToDesignDocumentOptions, ToSceneGraphOptions {}

export interface BrowserTailwindToDesignDocumentOptions
  extends Omit<BrowserToDesignDocumentOptions, 'cssText'>, CompileTailwindCSSOptions {}

export interface BrowserTailwindToSceneGraphOptions
  extends BrowserTailwindToDesignDocumentOptions, ToSceneGraphOptions {}

async function compileBrowserTailwindCSS(
  candidates: string | Iterable<string>,
  options: CompileTailwindCSSOptions
): Promise<string> {
  const { compileTailwindCSS } = await import('./import/tailwind')
  return compileTailwindCSS(candidates, options)
}

function resolveBrowserDocument(documentOverride: Document | undefined): Document {
  if (documentOverride) return documentOverride
  if (typeof document === 'undefined') {
    throw new TypeError('Browser DOM/CSS helpers require a DOM document')
  }
  return document
}

function parseWithBrowser(html: string, browserDocument: Document): Document {
  const Parser = browserDocument.defaultView?.DOMParser
  if (!Parser) throw new TypeError('Browser DOM/CSS helpers require DOMParser')
  return new Parser().parseFromString(html, 'text/html')
}

/** The page's `<link rel="stylesheet">` sheets as `@import` rules, in document order. */
/**
 * The page's linked stylesheets as `@import` rules. Without a base address, only those linked by a
 * full address: a relative one would resolve against the host instead of the page.
 */
function linkedStylesheetImports(
  html: string,
  browserDocument: Document,
  baseURL: string | undefined
): string | undefined {
  const links = parseWithBrowser(html, browserDocument).querySelectorAll('link')
  const sheets = compact(
    Array.from(links, (link) => linkedStylesheet((name) => link.getAttribute(name)))
  )
  return stylesheetImportRules(
    baseURL === undefined ? sheets.filter(({ href }) => URL.canParse(href)) : sheets
  )
}

function extractEmbeddedCSSText(html: string, browserDocument: Document): string | undefined {
  const parsed = parseWithBrowser(html, browserDocument)
  const styles = Array.from(parsed.querySelectorAll('style'))
    .map((style) => (style.textContent ? style.textContent.trim() : ''))
    .filter((css): css is string => !!css)
  return styles.length > 0 ? styles.join('\n') : undefined
}

/**
 * Whether HTML lays something out rather than only styling text: it brings a stylesheet, or an
 * element's own style draws or sizes a box. Text copied from inside one block of a page carries
 * text styling only; a copy spanning a card or a toolbar carries its boxes.
 */
export function browserHTMLHasBoxes(html: string, options: { document?: Document } = {}): boolean {
  const browserDocument = resolveBrowserDocument(options.document)
  if (extractEmbeddedCSSText(html, browserDocument)) return true
  return laysOutBoxes(createBrowserCSSRuntime({ document: browserDocument }).parseHTML(html))
}

export async function browserHTMLToDesignDocument(
  html: string,
  options: BrowserHTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  options.signal?.throwIfAborted()
  const browserDocument = resolveBrowserDocument(options.document)
  const runtime = createBrowserCSSRuntime({ ...options, document: browserDocument })
  const document = runtime.parseHTML(html)
  // `@import` rules count only before every other rule, so the linked sheets come first.
  const cssText = mergeCSSText(
    options.importLinkedStylesheets
      ? linkedStylesheetImports(html, browserDocument, options.baseURL)
      : undefined,
    extractEmbeddedCSSText(html, browserDocument),
    options.cssText
  )
  return runtime.computeStyles(document, cssText, options.compute)
}

export async function browserHTMLToSceneGraph(
  html: string,
  options: BrowserHTMLToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await browserHTMLToDesignDocument(html, options)
  options.signal?.throwIfAborted()
  const graph = designDocumentToSceneGraph(document, options)
  options.signal?.throwIfAborted()
  return graph
}

export async function browserTailwindHTMLToDesignDocument(
  html: string,
  candidates: string | Iterable<string>,
  options: BrowserTailwindHTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const cssText = await compileBrowserTailwindCSS(candidates, options)
  return browserHTMLToDesignDocument(html, { ...options, cssText })
}

export async function browserTailwindHTMLToSceneGraph(
  html: string,
  candidates: string | Iterable<string>,
  options: BrowserTailwindHTMLToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await browserTailwindHTMLToDesignDocument(html, candidates, options)
  options.signal?.throwIfAborted()
  const graph = designDocumentToSceneGraph(document, options)
  options.signal?.throwIfAborted()
  return graph
}

export async function browserJSXToDesignDocument(
  input: JSXChild,
  options: BrowserToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const document = jsxToDesignDocumentCore(input)
  const runtime = createBrowserCSSRuntime(options)
  return runtime.computeStyles(document, options.cssText, options.compute)
}

export async function browserJSXToSceneGraph(
  input: JSXChild,
  options: BrowserToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await browserJSXToDesignDocument(input, options)
  return designDocumentToSceneGraph(document, options)
}

export async function browserTailwindJSXToDesignDocument(
  input: JSXChild,
  candidates: string | Iterable<string>,
  options: BrowserTailwindToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const cssText = await compileBrowserTailwindCSS(candidates, options)
  return browserJSXToDesignDocument(input, { ...options, cssText })
}

export async function browserTailwindJSXToSceneGraph(
  input: JSXChild,
  candidates: string | Iterable<string>,
  options: BrowserTailwindToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await browserTailwindJSXToDesignDocument(input, candidates, options)
  return designDocumentToSceneGraph(document, options)
}
