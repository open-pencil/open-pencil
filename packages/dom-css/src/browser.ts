import type { SceneGraph } from '@open-pencil/core/scene-graph'

import { jsxToDesignDocument, type JSXChild } from './jsx/runtime'

export { Fragment, jsx, jsxs } from './jsx/runtime'
export type { JSXChild, JSXElementProps, JSXStyleInput, JSXTag } from './jsx/runtime'
import { createBrowserCSSRuntime, type BrowserCSSRuntimeOptions } from './runtime/browser'
import { compileTailwindCSS, type CompileTailwindCSSOptions } from './tailwind'
import { designDocumentToSceneGraph, type ToSceneGraphOptions } from './to-scene-graph'
import type { CSSComputeOptions, DesignDocument } from './types'

export interface BrowserToDesignDocumentOptions extends BrowserCSSRuntimeOptions {
  cssText?: string
  compute?: CSSComputeOptions
}

export interface BrowserToSceneGraphOptions
  extends BrowserToDesignDocumentOptions, ToSceneGraphOptions {}

export interface BrowserTailwindToDesignDocumentOptions
  extends Omit<BrowserToDesignDocumentOptions, 'cssText'>, CompileTailwindCSSOptions {}

export interface BrowserTailwindToSceneGraphOptions
  extends BrowserTailwindToDesignDocumentOptions, ToSceneGraphOptions {}

function createRuntime(options: BrowserCSSRuntimeOptions) {
  return createBrowserCSSRuntime({ sandbox: 'iframe', ...options })
}

export async function browserJSXToDesignDocument(
  input: JSXChild,
  options: BrowserToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const document = await jsxToDesignDocument(input)
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
  const cssText = await compileTailwindCSS(candidates, options)
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
