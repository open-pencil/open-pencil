import type { SceneGraph } from '@open-pencil/scene-graph'

import { compileTailwindCSS, type CompileTailwindCSSOptions } from '../tailwind'
import { designDocumentToSceneGraph, type ToSceneGraphOptions } from '../to-scene-graph'
import type { CSSComputeOptions, CSSRuntime, DesignDocument } from '../types'
import { jsxToDesignDocumentCore, type JSXChild } from './core'

export { Fragment, jsx, jsxs } from './core'
export type {
  JSXChild,
  JSXElementProps,
  JSXStyleInput,
  JSXStyleObject,
  JSXStyleValue,
  JSXTag
} from './core'

export interface JSXToDesignDocumentOptions {
  cssText?: string
  runtime?: CSSRuntime
  compute?: CSSComputeOptions
}

export interface JSXToSceneGraphOptions extends JSXToDesignDocumentOptions, ToSceneGraphOptions {}

export interface TailwindJSXToDesignDocumentOptions
  extends Omit<JSXToDesignDocumentOptions, 'cssText'>, CompileTailwindCSSOptions {}

export interface TailwindJSXToSceneGraphOptions
  extends TailwindJSXToDesignDocumentOptions, ToSceneGraphOptions {}

async function runtimeForOptions(runtime: CSSRuntime | undefined) {
  if (runtime) return runtime
  const { createCSSRuntime } = await import('../runtime')
  return createCSSRuntime()
}

export async function jsxToDesignDocument(
  input: JSXChild,
  options: JSXToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const document = jsxToDesignDocumentCore(input)

  if (!options.cssText && !options.runtime && !options.compute) return document
  const runtime = await runtimeForOptions(options.runtime)
  return runtime.computeStyles(document, options.cssText, options.compute)
}

export async function jsxToSceneGraph(
  input: JSXChild,
  options: JSXToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await jsxToDesignDocument(input, options)
  return designDocumentToSceneGraph(document, options)
}

export async function tailwindJSXToDesignDocument(
  input: JSXChild,
  candidates: string | Iterable<string>,
  options: TailwindJSXToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const cssText = await compileTailwindCSS(candidates, options)
  return jsxToDesignDocument(input, { ...options, cssText })
}

export async function tailwindJSXToSceneGraph(
  input: JSXChild,
  candidates: string | Iterable<string>,
  options: TailwindJSXToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await tailwindJSXToDesignDocument(input, candidates, options)
  return designDocumentToSceneGraph(document, options)
}

export type { JSX } from './core'
