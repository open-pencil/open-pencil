import {
  createHeadlessCSSRuntime,
  parseFontFaceRules,
  parseStylesheetImports,
  type CSSFontFaceRule,
  type CSSComputeOptions,
  type CSSRuntime,
  type DesignDocument,
  type DesignElement,
  type DesignLayout,
  type DesignStyleDeclaration,
  type DesignViewport
} from '@open-pencil/dom-css'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { HTMLEngine, HTMLEngineFetch, HTMLEngineResource } from './engine'
import { loadHTMLEngine } from './load'
import type { HTMLEngineCapture, HTMLEngineLine, HTMLEngineNode } from './schema'

/** The viewport a document is laid out in when the caller names none, as HTML import uses. */
const DEFAULT_VIEWPORT: DesignViewport = { width: 1440, height: 900 }

/** A font a page's `@font-face` rule loads: the face the rule declares, and the file as TrueType or OpenType. */
export interface HTMLEngineFontFace {
  family: string
  weight: number
  italic: boolean
  url: string
  bytes: Uint8Array
}

export interface HTMLEngineRuntimeOptions {
  /** The engine to lay documents out with, with the fonts they may use registered. */
  engine?: () => Promise<HTMLEngine>
  /** The document's URL, which its relative URLs resolve against. */
  baseURL?: string
  /**
   * Answers the stylesheets, fonts, and images the document asks for. A stylesheet is read for
   * its `@font-face` rules when it comes with a CSS content type.
   */
  fetch?: HTMLEngineFetch
  /**
   * Receives each font the page's `@font-face` rules load, as the engine lays text out in it, so
   * a host can draw that text in the same font. The layout waits for it.
   */
  onFontFace?: (face: HTMLEngineFontFace) => void | Promise<void>
}

function isStylesheet(resource: HTMLEngineResource): boolean {
  return resource.contentType?.split(';')[0]?.trim().toLowerCase() === 'text/css'
}

/**
 * A fetch that also reads the page's `@font-face` rules, from its own CSS and every stylesheet it
 * fetches, and passes each font they load to `onFontFace` as the engine receives it.
 */
function fontFaceFetch(
  engine: HTMLEngine,
  cssText: string,
  options: HTMLEngineRuntimeOptions
): HTMLEngineFetch | undefined {
  const { fetch, onFontFace } = options
  if (!fetch || !onFontFace) return fetch
  const rules = new Map<string, CSSFontFaceRule[]>()
  // What CSS imports is a stylesheet whatever its name or the type it is served as.
  const stylesheets = new Set<string>()
  // The engine fetches a file once per rule that names it; each face is passed on once.
  const delivered = new Set<string>()
  const learn = (css: string, base: string | undefined) => {
    for (const rule of parseFontFaceRules(css, base)) {
      for (const source of rule.sources) rules.set(source, [...(rules.get(source) ?? []), rule])
    }
    for (const url of parseStylesheetImports(css, base)) stylesheets.add(url)
  }
  learn(cssText, options.baseURL)
  return async (url, signal) => {
    const resource = await fetch(url, signal)
    if (!resource) return null
    if (isStylesheet(resource) || stylesheets.has(url) || stylesheets.has(resource.url)) {
      learn(new TextDecoder().decode(resource.bytes), resource.url)
    }
    // One file can serve several rules, such as a family and an alias of it.
    const served = rules.get(url) ?? rules.get(resource.url) ?? []
    const bytes = served.length > 0 ? engine.decodeFont(resource.bytes) : null
    for (const rule of served) {
      const face = `${url}|${rule.family}|${rule.weight}|${rule.italic}`
      if (!bytes || delivered.has(face)) continue
      delivered.add(face)
      await onFontFace({
        family: rule.family,
        weight: rule.weight,
        italic: rule.italic,
        url,
        bytes
      })
    }
    return resource
  }
}

type Box = HTMLEngineCapture['nodes'][number]['box']

function rect(box: NonNullable<Box>): Rect {
  const [x, y, width, height] = box
  return { x, y, width, height }
}

function hasArea(box: NonNullable<Box>): boolean {
  return box[2] > 0 && box[3] > 0
}

/** Children of each captured node that are elements, by the node's index; generated content left out. */
function elementChildren(capture: HTMLEngineCapture): Map<number, number[]> {
  const children = new Map<number, number[]>()
  for (const [index, node] of capture.nodes.entries()) {
    if (node.parent === undefined || node.tag === undefined || node.tag.startsWith('::')) continue
    const siblings = children.get(node.parent) ?? []
    siblings.push(index)
    children.set(node.parent, siblings)
  }
  return children
}

/**
 * Elements the HTML parser inserts around others where the markup leaves them out, such as the
 * `tbody` around a table's rows; a serialized document need not hold them.
 */
const IMPLIED_WRAPPERS = new Set(['tbody'])

/**
 * Each element of the document with the captured element it was laid out as: matched in order
 * and by tag, looking through wrappers the parser inserted. A mismatch ends the matching among
 * those siblings, so it never pairs an element with another's box.
 */
function pairElements(
  document: DesignDocument,
  capture: HTMLEngineCapture
): [DesignElement, HTMLEngineNode][] {
  const children = elementChildren(capture)
  const body = capture.nodes.findIndex((node) => node.tag === 'body')
  const pairs: [DesignElement, HTMLEngineNode][] = []
  const pair = (elements: readonly DesignElement[], parent: number, shaderFrame = false) => {
    const queue = [...(children.get(parent) ?? [])]
    // The serializer writes a shader's still frame as an image ahead of its layer's children.
    const first = queue.at(0)
    if (shaderFrame && first !== undefined && capture.nodes[first].tag === 'img') queue.shift()
    for (const element of elements) {
      let node = queue.shift()
      // The HTML parser keeps SVG's mixed-case names, such as `linearGradient`; the document may not.
      while (node !== undefined && !sameTag(capture.nodes[node].tag, element.tagName)) {
        const tag = capture.nodes[node].tag
        if (tag === undefined || !IMPLIED_WRAPPERS.has(tag)) return
        queue.unshift(...(children.get(node) ?? []))
        node = queue.shift()
      }
      if (node === undefined) return
      pairs.push([element, capture.nodes[node]])
      pair(designElements(element.children), node, element.shader?.frame !== undefined)
    }
  }
  if (body !== -1) pair(designElements(document.children), body)
  return pairs
}

function sameTag(captured: string | undefined, tagName: string): boolean {
  return captured?.toLowerCase() === tagName.toLowerCase()
}

function designElements(nodes: DesignDocument['children']): DesignElement[] {
  return nodes.filter((node): node is DesignElement => node.type === 'element')
}

/** Shorthands a browser runtime reports, `overflow` and `gap`, built from their captured longhands. */
function withShorthands(style: DesignStyleDeclaration): DesignStyleDeclaration {
  // Captures leave initial values out.
  const value = (property: string, initial: string) =>
    Object.hasOwn(style, property) ? style[property] : initial
  const pair = (first: string, second: string) => (first === second ? first : `${first} ${second}`)
  const shorthands: DesignStyleDeclaration = {}
  if (Object.hasOwn(style, 'overflow-x') || Object.hasOwn(style, 'overflow-y')) {
    shorthands.overflow = pair(value('overflow-x', 'visible'), value('overflow-y', 'visible'))
  }
  if (Object.hasOwn(style, 'row-gap') || Object.hasOwn(style, 'column-gap')) {
    shorthands.gap = pair(value('row-gap', 'normal'), value('column-gap', 'normal'))
  }
  return { ...style, ...shorthands }
}

/** White space values that keep spaces, so a line of them takes room as a line of words does. */
const PRESERVED_WHITE_SPACE = new Set(['pre', 'pre-wrap', 'break-spaces'])

/**
 * A line as a browser's text rects make it: across its words, leaving out inline boxes, and
 * nothing for a line without text. Where white space is kept, a line of spaces counts too.
 */
function textLine(line: HTMLEngineLine, keepsSpaces: boolean): Rect | null {
  const texts = line.runs.filter((run) => 'text' in run && run.text.length > 0)
  const words = keepsSpaces ? texts : texts.filter((run) => 'text' in run && run.text.trim() !== '')
  if (words.length === 0) return null
  const left = Math.min(...words.map((run) => run.x))
  const right = Math.max(...words.map((run) => run.x + run.width))
  return { x: left, y: line.y, width: right - left, height: line.height }
}

function layoutOf(node: HTMLEngineNode): DesignLayout | undefined {
  if (!node.box) return undefined
  const layout: DesignLayout = { box: rect(node.box) }
  const fragments = node.fragments?.filter(hasArea)
  if (fragments && fragments.length > 0) {
    layout.fragments = fragments.map(rect)
    return layout
  }
  const whiteSpace = node.style?.['white-space']
  const keepsSpaces = whiteSpace !== undefined && PRESERVED_WHITE_SPACE.has(whiteSpace)
  const lines = (node.lines ?? [])
    .map((line) => textLine(line, keepsSpaces))
    .filter((line) => line !== null)
  if (lines.length > 0) layout.lines = lines
  return layout
}

function documentHTML(body: string, cssText: string): string {
  // `</style` would end the stylesheet early.
  const css = cssText.replaceAll(/<\/style/gi, '<\\/style')
  return `<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`
}

/**
 * A CSS runtime that styles and lays documents out with the HTML engine, as a browser would,
 * without one: computed styles and, when asked, the boxes, inline fragments, and text lines a
 * browser runtime records, before transforms. Documents are parsed and serialized as the headless
 * runtime does.
 */
export function createHTMLEngineRuntime(options: HTMLEngineRuntimeOptions = {}): CSSRuntime {
  const markup = createHeadlessCSSRuntime()
  const engine = options.engine ?? loadHTMLEngine
  return {
    kind: 'headless',
    parseHTML: (html) => markup.parseHTML(html),
    serializeHTML: (document) => markup.serializeHTML(document),
    async computeStyles(document, cssText = '', compute: CSSComputeOptions = {}) {
      const laidOut = await engine()
      const capture = await laidOut.layout(documentHTML(markup.serializeHTML(document), cssText), {
        baseURL: options.baseURL,
        viewport: compute.viewport ?? DEFAULT_VIEWPORT,
        fetch: fontFaceFetch(laidOut, cssText, options)
      })
      const styled = structuredClone(document)
      for (const [element, node] of pairElements(styled, capture)) {
        // Every captured property's computed value, so none falls back to a stale inline one.
        element.computedStyle = withShorthands({ ...capture.initial, ...node.style })
        if (compute.layout) element.layout = layoutOf(node)
      }
      return styled
    }
  }
}
