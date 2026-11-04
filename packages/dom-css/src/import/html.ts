import cssesc from 'cssesc'
import { parse, type DefaultTreeAdapterTypes } from 'parse5'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { createCSSRuntime } from '../runtime'
import type { CSSComputeOptions, CSSRuntime, DesignDocument } from '../types'
import { mergeCSSText } from './css-text'
import { designDocumentToSceneGraph, type ToSceneGraphOptions } from './scene-graph'
import { compileTailwindCSS, type CompileTailwindCSSOptions } from './tailwind'

export interface HTMLToDesignDocumentOptions {
  cssText?: string
  runtime?: CSSRuntime
  compute?: CSSComputeOptions
  /**
   * Turns the page's `<link rel="stylesheet">` elements into `@import` rules ahead of its CSS,
   * for a runtime that fetches what a stylesheet imports. Parsing drops the elements otherwise.
   */
  importLinkedStylesheets?: boolean
}

export interface HTMLToSceneGraphOptions extends HTMLToDesignDocumentOptions, ToSceneGraphOptions {}

export interface TailwindHTMLToDesignDocumentOptions
  extends Omit<HTMLToDesignDocumentOptions, 'cssText'>, CompileTailwindCSSOptions {}

export interface TailwindHTMLToSceneGraphOptions
  extends TailwindHTMLToDesignDocumentOptions, ToSceneGraphOptions {}

function runtimeForOptions(runtime: CSSRuntime | undefined) {
  return runtime ?? createCSSRuntime()
}

function getChildNodes(node: DefaultTreeAdapterTypes.Node): DefaultTreeAdapterTypes.ChildNode[] {
  return 'childNodes' in node ? node.childNodes : []
}

function textContent(node: DefaultTreeAdapterTypes.Node): string {
  if (node.nodeName === '#text' && 'value' in node) return node.value
  return getChildNodes(node).map(textContent).join('')
}

function collectStyleText(node: DefaultTreeAdapterTypes.Node, styles: string[]): void {
  if ('tagName' in node && node.tagName.toLowerCase() === 'style') {
    const css = textContent(node).trim()
    if (css) styles.push(css)
    return
  }

  for (const child of getChildNodes(node)) collectStyleText(child, styles)
}

function extractEmbeddedCSSText(html: string): string | undefined {
  const styles: string[] = []
  collectStyleText(parse(html), styles)
  return styles.length > 0 ? styles.join('\n') : undefined
}

function attribute(node: DefaultTreeAdapterTypes.Element, name: string): string | undefined {
  return node.attrs.find((attr) => attr.name === name)?.value
}

/** Whether a `<link>` loads a stylesheet that applies to a screen: not an alternate, not print. */
function isScreenStylesheet(node: DefaultTreeAdapterTypes.Element): boolean {
  const rel = attribute(node, 'rel')?.toLowerCase().split(/\s+/) ?? []
  if (!rel.includes('stylesheet') || rel.includes('alternate')) return false
  const media = attribute(node, 'media')?.trim().toLowerCase()
  return media === undefined || media === '' || media === 'all' || media === 'screen'
}

function collectLinkedStylesheets(node: DefaultTreeAdapterTypes.Node, hrefs: string[]): void {
  if ('tagName' in node && node.tagName.toLowerCase() === 'link' && isScreenStylesheet(node)) {
    const href = attribute(node, 'href')?.trim()
    if (href) hrefs.push(href)
    return
  }
  for (const child of getChildNodes(node)) collectLinkedStylesheets(child, hrefs)
}

/** The page's linked stylesheets as `@import` rules, in document order. */
function linkedStylesheetImports(html: string): string | undefined {
  const hrefs: string[] = []
  collectLinkedStylesheets(parse(html), hrefs)
  if (hrefs.length === 0) return undefined
  return hrefs
    .map((href) => `@import url(${cssesc(href, { quotes: 'double', wrap: true })});`)
    .join('\n')
}

export async function htmlToDesignDocument(
  html: string,
  options: HTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const runtime = runtimeForOptions(options.runtime)
  const document = runtime.parseHTML(html)
  // `@import` rules count only before every other rule, so the linked sheets come first.
  const cssText = mergeCSSText(
    options.importLinkedStylesheets ? linkedStylesheetImports(html) : undefined,
    extractEmbeddedCSSText(html),
    options.cssText
  )
  return runtime.computeStyles(document, cssText, options.compute)
}

export async function htmlToSceneGraph(
  html: string,
  options: HTMLToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await htmlToDesignDocument(html, options)
  return designDocumentToSceneGraph(document, options)
}

export async function tailwindHTMLToDesignDocument(
  html: string,
  candidates: string | Iterable<string>,
  options: TailwindHTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const cssText = await compileTailwindCSS(candidates, options)
  return htmlToDesignDocument(html, { ...options, cssText })
}

export async function tailwindHTMLToSceneGraph(
  html: string,
  candidates: string | Iterable<string>,
  options: TailwindHTMLToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await tailwindHTMLToDesignDocument(html, candidates, options)
  return designDocumentToSceneGraph(document, options)
}
