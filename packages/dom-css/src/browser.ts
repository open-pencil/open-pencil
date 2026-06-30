import type { SceneGraph } from '@open-pencil/scene-graph'

import { mergeCSSText } from './css-text'
import { jsxToDesignDocumentCore, type JSXChild } from './jsx/core'
import { createBrowserCSSRuntime, type BrowserCSSRuntimeOptions } from './runtime/browser'
import type { CompileTailwindCSSOptions } from './tailwind'
import { designDocumentToSceneGraph, type ToSceneGraphOptions } from './to-scene-graph'
import type { CSSComputeOptions, DesignDocument } from './types'

export { Fragment, jsx, jsxs } from './jsx/core'
export type { JSXChild, JSXElementProps, JSXStyleInput, JSXTag } from './jsx/core'

export interface BrowserToDesignDocumentOptions extends BrowserCSSRuntimeOptions {
  cssText?: string
  compute?: CSSComputeOptions
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

function createRuntime(options: BrowserCSSRuntimeOptions) {
  return createBrowserCSSRuntime({ sandbox: 'iframe', ...options })
}

async function compileBrowserTailwindCSS(
  candidates: string | Iterable<string>,
  options: CompileTailwindCSSOptions
): Promise<string> {
  const { compileTailwindCSS } = await import('./tailwind')
  return compileTailwindCSS(candidates, options)
}

function resolveBrowserDocument(documentOverride: Document | undefined): Document {
  if (documentOverride) return documentOverride
  if (typeof document === 'undefined') {
    throw new TypeError('Browser DOM/CSS helpers require a DOM document')
  }
  return document
}

function extractEmbeddedCSSText(html: string, browserDocument: Document): string | undefined {
  const Parser = browserDocument.defaultView?.DOMParser
  if (!Parser) throw new TypeError('Browser DOM/CSS helpers require DOMParser')
  const parsed = new Parser().parseFromString(html, 'text/html')
  const styles = Array.from(parsed.querySelectorAll('style'))
    .map((style) => (style.textContent ? style.textContent.trim() : ''))
    .filter((css): css is string => !!css)
  return styles.length > 0 ? styles.join('\n') : undefined
}

export async function browserHTMLToDesignDocument(
  html: string,
  options: BrowserHTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const browserDocument = resolveBrowserDocument(options.document)
  const runtime = createRuntime({ ...options, document: browserDocument })
  const document = runtime.parseHTML(html)
  const cssText = mergeCSSText(extractEmbeddedCSSText(html, browserDocument), options.cssText)
  return runtime.computeStyles(document, cssText, options.compute)
}

export async function browserHTMLToSceneGraph(
  html: string,
  options: BrowserHTMLToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await browserHTMLToDesignDocument(html, options)
  return designDocumentToSceneGraph(document, options)
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
  return designDocumentToSceneGraph(document, options)
}

export async function browserJSXToDesignDocument(
  input: JSXChild,
  options: BrowserToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const document = jsxToDesignDocumentCore(input)
  const runtime = createRuntime(options)
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
