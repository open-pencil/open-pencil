import { parse, type DefaultTreeAdapterTypes } from 'parse5'

import type { SceneGraph } from '@open-pencil/core/scene-graph'

import { mergeCSSText } from './css-text'
import { createCSSRuntime } from './runtime'
import { compileTailwindCSS, type CompileTailwindCSSOptions } from './tailwind'
import { designDocumentToSceneGraph, type ToSceneGraphOptions } from './to-scene-graph'
import type { CSSComputeOptions, CSSRuntime, DesignDocument } from './types'

export interface HTMLToDesignDocumentOptions {
  cssText?: string
  runtime?: CSSRuntime
  compute?: CSSComputeOptions
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

export async function htmlToDesignDocument(
  html: string,
  options: HTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const runtime = runtimeForOptions(options.runtime)
  const document = runtime.parseHTML(html)
  const cssText = mergeCSSText(extractEmbeddedCSSText(html), options.cssText)
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
