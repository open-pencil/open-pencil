import {
  attachImages,
  backgroundImageURLs,
  parseFontFaceRules,
  parseHTMLDocument,
  parseStylesheetImports,
  type CSSFontFaceRule,
  type CSSComputeOptions,
  type CSSRuntime,
  type DesignDocument,
  type DesignElement,
  type DesignLayout,
  type DesignResource,
  type DesignResourceFetch,
  type DesignStyleDeclaration,
  type DesignViewport
} from '@open-pencil/dom-css'
import { serializeHTML } from '@open-pencil/dom-css/export'
import { parseCSSColor } from '@open-pencil/scene-graph/css'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { insertAll, maxOf, minOf } from '@open-pencil/std/arrays'

import type { HTMLEngine } from './engine'
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
  fetch?: DesignResourceFetch
  /**
   * Receives each font the page's `@font-face` rules load, as the engine lays text out in it, so
   * a host can draw that text in the same font. The layout waits for it.
   */
  onFontFace?: (face: HTMLEngineFontFace) => void | Promise<void>
}

function isStylesheet(resource: DesignResource): boolean {
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
): DesignResourceFetch | undefined {
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
        insertAll(queue, 0, children.get(node) ?? [])
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
  const left = minOf(words.map((run) => run.x))
  const right = maxOf(words.map((run) => run.x + run.width))
  return { x: left, y: line.y, width: right - left, height: line.height }
}

function layoutOf(node: HTMLEngineNode): DesignLayout | undefined {
  if (!node.box) return undefined
  const layout: DesignLayout = { box: rect(node.box) }
  const fragments = node.fragments?.filter(hasArea)
  if (fragments && fragments.length > 0) {
    layout.fragments = fragments.map(rect)
    // An inline element's box is the one around its fragments, as getBoundingClientRect gives.
    layout.box = computeBounds(layout.fragments)
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
 * browser runtime records, before transforms. Documents are parsed and serialized by dom-css.
 */
/** The `::before` and `::after` nodes of each captured element, by the element's index. */
function generatedChildren(capture: HTMLEngineCapture): Map<number, number[]> {
  const generated = new Map<number, number[]>()
  for (const [index, node] of capture.nodes.entries()) {
    if (node.parent === undefined || !node.tag?.startsWith('::')) continue
    generated.set(node.parent, [...(generated.get(node.parent) ?? []), index])
  }
  return generated
}

/** The text a captured node holds directly, as a pseudo-element's generated content. */
/** Each captured node's own text, its text children's joined in order, by the node's index. */
function ownTexts(capture: HTMLEngineCapture): Map<number, string> {
  const texts = new Map<number, string>()
  for (const node of capture.nodes) {
    if (node.text === undefined || node.parent === undefined) continue
    texts.set(node.parent, (texts.get(node.parent) ?? '') + node.text)
  }
  return texts
}

/**
 * Shows each element's `::before` and `::after` as elements of their own, first and last among its
 * children, with the style, box, and text the engine generated for them, so they are imported as
 * any element is.
 */
function showGeneratedContent(
  capture: HTMLEngineCapture,
  pairs: readonly [DesignElement, HTMLEngineNode][],
  layout: boolean
): void {
  const indexes = new Map(capture.nodes.map((node, index) => [node, index]))
  const generated = generatedChildren(capture)
  const texts = ownTexts(capture)
  for (const [element, node] of pairs) {
    const index = indexes.get(node)
    for (const pseudo of (index === undefined ? undefined : generated.get(index)) ?? []) {
      const captured = capture.nodes[pseudo]
      const text = texts.get(pseudo) ?? ''
      const child: DesignElement = {
        type: 'element',
        tagName: captured.tag ?? '::before',
        attrs: {},
        children: text ? [{ type: 'text', text }] : [],
        computedStyle: withShorthands({
          ...capture.initial,
          ...captured.style,
          ...captured.computed
        })
      }
      if (layout) child.layout = layoutOf(captured)
      if (captured.tag === '::after') element.children.push(child)
      else element.children.unshift(child)
    }
  }
}

/**
 * The color the page's canvas is painted, as CSS takes it: the root element's background, or the
 * body's when the root has none.
 */
function canvasBackground(capture: HTMLEngineCapture): string | undefined {
  const background = (tag: string) => {
    const node = capture.nodes.find((candidate) => candidate.tag === tag)
    const color = node?.style?.['background-color']
    return color && parseCSSColor(color) ? color : undefined
  }
  return background('html') ?? background('body')
}

/** A fetch that also keeps what it answered, by the URL asked for and the one it came from. */
function keepingFetch(
  fetch: DesignResourceFetch | undefined,
  answered: Map<string, DesignResource>
): DesignResourceFetch | undefined {
  if (!fetch) return undefined
  return async (url, signal) => {
    const resource = await fetch(url, signal)
    if (resource) answered.set(url, resource).set(resource.url, resource)
    return resource
  }
}

/** A fetch that answers from what the engine already loaded before it asks `fetch`. */
function loadedFirst(
  answered: ReadonlyMap<string, DesignResource>,
  fetch: DesignResourceFetch | undefined
): DesignResourceFetch | undefined {
  if (!fetch) return undefined
  return async (url, signal) => answered.get(url) ?? fetch(url, signal)
}

/** What an `<img>` loaded, by its `src` resolved against the page's address. */
function imageOf(
  element: DesignElement,
  answered: ReadonlyMap<string, DesignResource>,
  baseURL: string | undefined
): DesignResource | undefined {
  const { src } = element.attrs
  if (element.tagName.toLowerCase() !== 'img' || !src || !URL.canParse(src, baseURL)) {
    return undefined
  }
  return answered.get(new URL(src, baseURL).href)
}

export function createHTMLEngineRuntime(options: HTMLEngineRuntimeOptions = {}): CSSRuntime {
  const engine = options.engine ?? loadHTMLEngine
  return {
    kind: 'headless',
    parseHTML: parseHTMLDocument,
    serializeHTML,
    async computeStyles(document, cssText = '', compute: CSSComputeOptions = {}) {
      const laidOut = await engine()
      // The pictures the engine loads to lay images out go with their elements, so the layers
      // they become show them without fetching them again.
      const answered = new Map<string, DesignResource>()
      const fetch = keepingFetch(options.fetch, answered)
      const capture = await laidOut.layout(documentHTML(serializeHTML(document), cssText), {
        baseURL: options.baseURL,
        viewport: compute.viewport ?? DEFAULT_VIEWPORT,
        fetch: fontFaceFetch(laidOut, cssText, { ...options, fetch })
      })
      const styled = structuredClone(document)
      const pairs = pairElements(styled, capture)
      for (const [element, node] of pairs) {
        // Every captured property's computed value, so none falls back to a stale inline one, with
        // sizes and line heights as the page set them rather than as layout resolved them, so the
        // importer tells a size the page fixed from one that fills or hugs and keeps a line height
        // that scales with the font; the boxes layout gave stay in `layout`.
        element.computedStyle = withShorthands({
          ...capture.initial,
          ...node.style,
          ...node.computed
        })
        if (compute.layout) element.layout = layoutOf(node)
        const image = imageOf(element, answered, options.baseURL)
        if (image) element.image = image
      }
      // Background pictures the engine loaded are kept; any it did not are read as images are.
      const backgrounds = pairs
        .map(([element]) => element)
        .filter((element) => backgroundImageURLs(element).length > 0)
      await attachImages([], loadedFirst(answered, options.fetch), backgrounds)
      showGeneratedContent(capture, pairs, compute.layout === true)
      styled.background = canvasBackground(capture)
      return styled
    }
  }
}
