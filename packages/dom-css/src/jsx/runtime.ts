import type { SceneGraph } from '@open-pencil/core/scene-graph'

import { compileTailwindCSS, type CompileTailwindCSSOptions } from '../tailwind'
import { designDocumentToSceneGraph, type ToSceneGraphOptions } from '../to-scene-graph'
import type {
  CSSComputeOptions,
  CSSRuntime,
  DesignDocument,
  DesignNode,
  DesignStyleDeclaration
} from '../types'

export const Fragment = Symbol.for('open-pencil.dom-css.fragment')

type JSXComponent = (props: JSXElementProps) => JSXChild
export type JSXTag = string | JSXComponent | typeof Fragment
export type JSXStyleValue = string | number | null | undefined
export type JSXStyleObject = Record<string, JSXStyleValue>
export type JSXStyleInput = string | JSXStyleObject
export type JSXChild = DesignNode | JSXChild[] | string | number | boolean | null | undefined

export interface JSXElementProps {
  children?: JSXChild
  class?: string
  className?: string
  style?: JSXStyleInput
  key?: string | number
  [name: string]: unknown
}

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

function cssPropertyName(name: string) {
  if (name.startsWith('--')) return name
  return name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
}

function styleObjectToDeclaration(style: JSXStyleObject): DesignStyleDeclaration | undefined {
  const entries = Object.entries(style)
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined
    )
    .map(([property, value]) => [cssPropertyName(property), String(value)] as const)
    .filter(([, value]) => value.length > 0)

  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

function styleStringToDeclaration(style: string): DesignStyleDeclaration | undefined {
  const entries = style
    .split(';')
    .map((declaration) => declaration.split(':'))
    .filter((parts): parts is [string, string, ...string[]] => parts.length >= 2)
    .map(([property, ...value]) => [property.trim().toLowerCase(), value.join(':').trim()] as const)
    .filter(([property, value]) => property.length > 0 && value.length > 0)

  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

function styleToDeclaration(style: JSXStyleInput | undefined): DesignStyleDeclaration | undefined {
  if (typeof style === 'string') return styleStringToDeclaration(style)
  if (style) return styleObjectToDeclaration(style)
  return undefined
}

function attributeValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === false) return undefined
  if (value === true) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return undefined
}

function propsToAttrs(props: JSXElementProps): Record<string, string> {
  const attrs: Record<string, string> = {}
  const classValue = props.class ?? props.className
  if (classValue) attrs.class = classValue

  for (const [name, value] of Object.entries(props)) {
    if (name === 'children' || name === 'class' || name === 'className' || name === 'style')
      continue
    if (name === 'key' || name.startsWith('on')) continue
    const attr = attributeValue(value)
    if (attr !== undefined) attrs[name] = attr
  }

  return attrs
}

function normalizeChild(child: JSXChild, nodes: DesignNode[]): void {
  if (child === null || child === undefined || typeof child === 'boolean') return
  if (Array.isArray(child)) {
    for (const item of child) normalizeChild(item, nodes)
    return
  }
  if (typeof child === 'string' || typeof child === 'number') {
    nodes.push({ type: 'text', text: String(child) })
    return
  }
  nodes.push(child)
}

function normalizeChildren(children: JSXChild): DesignNode[] {
  const nodes: DesignNode[] = []
  normalizeChild(children, nodes)
  return nodes
}

export function jsx(tag: JSXTag, props: JSXElementProps = {}): DesignNode | DesignNode[] {
  if (tag === Fragment) return normalizeChildren(props.children)
  if (typeof tag === 'function') return normalizeChildren(tag(props))

  return {
    type: 'element',
    tagName: tag,
    attrs: propsToAttrs(props),
    inlineStyle: styleToDeclaration(props.style),
    children: normalizeChildren(props.children)
  }
}

export const jsxs = jsx

export async function jsxToDesignDocument(
  input: JSXChild,
  options: JSXToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const document: DesignDocument = {
    type: 'document',
    children: normalizeChildren(input)
  }

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

export namespace JSX {
  export type Element = DesignNode | DesignNode[]
  export interface ElementChildrenAttribute {
    children: unknown
  }
  export interface IntrinsicElements {
    [tagName: string]: JSXElementProps
  }
}
