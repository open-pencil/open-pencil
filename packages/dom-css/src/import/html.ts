import { parse, type DefaultTreeAdapterTypes } from 'parse5'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { createCSSRuntime } from '../runtime'
import type { CSSComputeOptions, CSSRuntime, DesignDocument } from '../types'
import { mergeCSSText } from './css-text'
import {
  linkedStylesheet,
  stylesheetImportRules,
  type LinkedStylesheet
} from './linked-stylesheets'
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

function collectLinkedStylesheets(
  node: DefaultTreeAdapterTypes.Node,
  sheets: LinkedStylesheet[]
): void {
  if ('tagName' in node && node.tagName.toLowerCase() === 'link') {
    const element = node
    const sheet = linkedStylesheet((name) => attribute(element, name))
    if (sheet) sheets.push(sheet)
    return
  }
  for (const child of getChildNodes(node)) collectLinkedStylesheets(child, sheets)
}

/** The page's linked stylesheets as `@import` rules, as `stylesheetImportRules` writes them. */
function linkedStylesheetImports(html: string): string | undefined {
  const sheets: LinkedStylesheet[] = []
  collectLinkedStylesheets(parse(html), sheets)
  return stylesheetImportRules(sheets)
}

/** Everything that styles a page: its linked and embedded stylesheets, then `cssText`. */
export function htmlStylesheet(
  html: string,
  options: Pick<HTMLToDesignDocumentOptions, 'cssText' | 'importLinkedStylesheets'> = {}
): string | undefined {
  // `@import` rules count only before every other rule, so the linked sheets come first.
  return mergeCSSText(
    options.importLinkedStylesheets ? linkedStylesheetImports(html) : undefined,
    extractEmbeddedCSSText(html),
    options.cssText
  )
}

export async function htmlToDesignDocument(
  html: string,
  options: HTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const runtime = runtimeForOptions(options.runtime)
  const document = runtime.parseHTML(html)
  const cssText = htmlStylesheet(html, options)
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
