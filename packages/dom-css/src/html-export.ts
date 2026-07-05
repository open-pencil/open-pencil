import { CSSFontFaceRule } from '@acemir/cssom'
import { parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5'

import { normalizeFontFamily } from '@open-pencil/core/text'
import {
  exportWebFontFaceAssets,
  type WebFontFaceAsset,
  type WebFontFaceRequest
} from '@open-pencil/core/text/web-font/assets'

import { mergeClassNames, serializeHTML, splitWhitespace } from './serialize'
import type { DesignDocument, DesignElement, DesignNode, DesignStyleDeclaration } from './types'

export interface ExportHTMLBundleOptions {
  html?: 'fragment' | 'standalone'
  style?: 'inline' | 'tailwind'
  assets?: 'inline' | 'external'
  fonts?: 'assets' | 'none'
  assetBasePath?: string
}

export interface ExportHTMLFile {
  path: string
  content: string | Uint8Array
}

export interface ExportHTMLBundle {
  entrypoint: string
  files: ExportHTMLFile[]
}

interface StandaloneBounds {
  minX: number
  minY: number
  width: number
  height: number
}

type ParseNode = DefaultTreeAdapterTypes.Node
type ParseParent = DefaultTreeAdapterTypes.ParentNode
type ParseElement = DefaultTreeAdapterTypes.Element

const RESET_CSS =
  '*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#fff}'

function styleToCSS(style: DesignStyleDeclaration): string {
  return Object.entries(style)
    .filter(([, value]) => value !== '')
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ')
}

function cloneNode(node: DesignNode): DesignNode {
  if (node.type === 'text') return { ...node }
  return {
    ...node,
    attrs: { ...node.attrs },
    inlineStyle: node.inlineStyle ? { ...node.inlineStyle } : undefined,
    children: node.children.map(cloneNode)
  }
}

function standaloneStyleForNode(
  node: DesignElement,
  parent: DesignElement | undefined,
  origin: StandaloneBounds
): DesignStyleDeclaration {
  const style = { ...node.inlineStyle }
  const source = node.sourceSceneNode
  if (!source) return style

  style.position = 'absolute'
  style.left = `${source.x - (parent ? 0 : origin.minX)}px`
  style.top = `${source.y - (parent ? 0 : origin.minY)}px`
  return style
}

function standaloneNode(
  node: DesignNode,
  origin: StandaloneBounds,
  parent?: DesignElement
): DesignNode {
  if (node.type === 'text') return cloneNode(node)
  const standalone: DesignElement = {
    ...node,
    attrs: { ...node.attrs },
    inlineStyle: standaloneStyleForNode(node, parent, origin),
    children: []
  }
  standalone.children = node.children.map((child) => standaloneNode(child, origin, node))
  return standalone
}

function nodeBounds(node: DesignNode): StandaloneBounds | undefined {
  if (node.type === 'text' || !node.sourceSceneNode) return undefined
  return {
    minX: node.sourceSceneNode.x,
    minY: node.sourceSceneNode.y,
    width: node.sourceSceneNode.width,
    height: node.sourceSceneNode.height
  }
}

function standaloneSize(document: DesignDocument): StandaloneBounds {
  const bounds = document.children
    .map(nodeBounds)
    .filter((value): value is NonNullable<typeof value> => value !== undefined)
  const minX = bounds.length > 0 ? Math.min(...bounds.map((bound) => bound.minX)) : 0
  const minY = bounds.length > 0 ? Math.min(...bounds.map((bound) => bound.minY)) : 0
  const maxX = bounds.length > 0 ? Math.max(...bounds.map((bound) => bound.minX + bound.width)) : 1
  const maxY = bounds.length > 0 ? Math.max(...bounds.map((bound) => bound.minY + bound.height)) : 1
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

function standaloneDocument(document: DesignDocument, size: StandaloneBounds): DesignDocument {
  return {
    ...document,
    children: document.children.map((node) => standaloneNode(node, size))
  }
}

function cssClassName(index: number): string {
  return `op-${index.toString(36)}`
}

function extractInlineStyles(
  node: DesignNode,
  rules: string[],
  nextIndex: { value: number }
): DesignNode {
  if (node.type === 'text') return node
  const children = node.children.map((child) => extractInlineStyles(child, rules, nextIndex))
  if (!node.inlineStyle || Object.keys(node.inlineStyle).length === 0) return { ...node, children }

  const className = cssClassName(nextIndex.value)
  nextIndex.value += 1
  rules.push(`.${className}{${styleToCSS(node.inlineStyle)}}`)
  return {
    ...node,
    attrs: { ...node.attrs, class: mergeClassNames(node.attrs.class, className) ?? className },
    inlineStyle: undefined,
    children
  }
}

function isElement(node: ParseNode): node is ParseElement {
  return 'attrs' in node && 'tagName' in node
}

function walkParseTree(node: ParseNode | ParseParent, visit: (node: ParseElement) => void): void {
  if (isElement(node)) visit(node)
  if ('childNodes' in node) {
    for (const child of node.childNodes) walkParseTree(child, visit)
  }
}

function classNamesFromHTML(html: string): string[] {
  const fragment = parseFragment(html)
  const classes = new Set<string>()
  walkParseTree(fragment, (element) => {
    const classAttr = element.attrs.find((attr) => attr.name === 'class')
    if (!classAttr) return
    for (const className of splitWhitespace(classAttr.value)) classes.add(className)
  })
  return [...classes]
}

async function compileTailwindClasses(classNames: string[]): Promise<string> {
  if (classNames.length === 0) return ''
  const [{ compile }, { readFile }] = await Promise.all([
    import('tailwindcss'),
    import('node:fs/promises')
  ])
  const [themeCSS, utilitiesCSS] = await Promise.all([
    readFile(new URL(import.meta.resolve('tailwindcss/theme.css')), 'utf8'),
    readFile(new URL(import.meta.resolve('tailwindcss/utilities.css')), 'utf8')
  ])
  const compiler = await compile(`${themeCSS}\n${utilitiesCSS}`)
  return compiler.build(classNames)
}

function stripFontFamilyQuotes(value: string): string {
  if (value.length < 2) return value
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1)
  return value
}

function firstFontFamily(value: string): string {
  const commaIndex = value.indexOf(',')
  const raw = commaIndex !== -1 ? value.slice(0, commaIndex) : value
  return stripFontFamilyQuotes(raw.trim())
}

function collectFontRequests(node: DesignNode, fonts: Map<string, WebFontFaceRequest>): void {
  if (node.type === 'text') return
  const source = node.sourceSceneNode
  if (source?.type === 'TEXT') {
    const family = normalizeFontFamily(firstFontFamily(source.fontFamily))
    const style = source.italic ? 'italic' : 'normal'
    const key = `${family}|${source.fontWeight}|${style}`
    fonts.set(key, { family, weight: source.fontWeight, style })
  }
  for (const child of node.children) collectFontRequests(child, fonts)
}

function serializeFontWeight(weight: string | number | [number, number]): string {
  return Array.isArray(weight) ? weight.join(' ') : String(weight)
}

function fontSourceValue(asset: WebFontFaceAsset): string {
  const url = new URL(asset.path, 'file:///')
  const escapedPath = url.pathname.slice(1)
  return ['url(', JSON.stringify(escapedPath), ') format(', JSON.stringify(asset.format), ')'].join(
    ''
  )
}

function fontFaceCSS(asset: WebFontFaceAsset): string {
  const rule = new CSSFontFaceRule()
  rule.style.setProperty('font-family', JSON.stringify(asset.family))
  rule.style.setProperty('src', fontSourceValue(asset))
  rule.style.setProperty('font-weight', serializeFontWeight(asset.weight))
  rule.style.setProperty('font-style', asset.style)
  rule.style.setProperty('font-display', asset.display ?? 'swap')
  if (asset.stretch) rule.style.setProperty('font-stretch', asset.stretch)
  if (asset.unicodeRange && asset.unicodeRange.length > 0) {
    rule.style.setProperty('unicode-range', asset.unicodeRange.join(','))
  }
  return rule.cssText
}

async function fontFaceAssets(
  document: DesignDocument,
  options: Required<ExportHTMLBundleOptions>
): Promise<{ css: string; files: ExportHTMLFile[] }> {
  if (options.fonts === 'none' || options.assets !== 'external') return { css: '', files: [] }
  const requests = new Map<string, WebFontFaceRequest>()
  for (const child of document.children) collectFontRequests(child, requests)
  const result = await exportWebFontFaceAssets({
    fonts: [...requests.values()],
    assetBasePath: `${options.assetBasePath}/fonts`
  })
  return { css: result.assets.map(fontFaceCSS).join(''), files: result.assets }
}

function dataImageParts(value: string): { mime: string; base64: string } | undefined {
  if (!value.startsWith('data:image/')) return undefined
  const marker = ';base64,'
  const markerIndex = value.indexOf(marker)
  if (markerIndex === -1) return undefined
  return {
    mime: value.slice('data:'.length, markerIndex),
    base64: value.slice(markerIndex + marker.length)
  }
}

function bytesFromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/svg+xml') return 'svg'
  return 'png'
}

function extractImageAssets(
  html: string,
  assetBasePath: string
): { html: string; files: ExportHTMLFile[] } {
  const fragment = parseFragment(html)
  const files: ExportHTMLFile[] = []
  const sources = new Map<string, string>()
  walkParseTree(fragment, (element) => {
    const src = element.attrs.find((attr) => attr.name === 'src')
    if (!src) return
    const parts = dataImageParts(src.value)
    if (!parts) return
    const cachedPath = sources.get(src.value)
    if (cachedPath) {
      src.value = cachedPath
      return
    }
    const path = `${assetBasePath}/images/image-${sources.size + 1}.${extensionForMime(parts.mime)}`
    sources.set(src.value, path)
    files.push({ path, content: bytesFromBase64(parts.base64) })
    src.value = path
  })
  return { html: serialize(fragment), files }
}

function stylesheetLink(path: string): string {
  return `<link rel="stylesheet" href="${path}">`
}

function styleTag(css: string): string {
  return css ? `<style>${css}</style>` : ''
}

async function exportStandaloneHTML(
  document: DesignDocument,
  options: Required<ExportHTMLBundleOptions>
): Promise<ExportHTMLBundle> {
  const size = standaloneSize(document)
  const doc = standaloneDocument(document, size)
  const stageCSS = `.op-stage{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:transparent}`
  let body: string
  let css = `${RESET_CSS}${stageCSS}`

  if (options.style === 'tailwind') {
    body = serializeHTML(doc, { style: 'tailwind' })
    css += await compileTailwindClasses(classNamesFromHTML(body))
  } else {
    const rules: string[] = []
    const index = { value: 0 }
    const styledDocument: DesignDocument = {
      ...doc,
      children: doc.children.map((node) => extractInlineStyles(node, rules, index))
    }
    body = serializeHTML(styledDocument)
    css += rules.join('')
  }

  if (options.assets === 'external') {
    const [extracted, fonts] = await Promise.all([
      Promise.resolve(extractImageAssets(body, options.assetBasePath)),
      fontFaceAssets(document, options)
    ])
    body = extracted.html
    const cssPath = `${options.assetBasePath}/openpencil.css`
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${stylesheetLink(cssPath)}</head><body><main data-open-pencil-html="standalone" class="op-stage">${body}</main></body></html>`
    return {
      entrypoint: 'index.html',
      files: [
        { path: 'index.html', content: html },
        { path: cssPath, content: `${fonts.css}${css}` },
        ...fonts.files,
        ...extracted.files
      ]
    }
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styleTag(css)}</head><body><main data-open-pencil-html="standalone" class="op-stage">${body}</main></body></html>`
  return { entrypoint: 'index.html', files: [{ path: 'index.html', content: html }] }
}

export async function exportHTMLBundle(
  document: DesignDocument,
  options: ExportHTMLBundleOptions = {}
): Promise<ExportHTMLBundle> {
  const resolvedOptions: Required<ExportHTMLBundleOptions> = {
    html: options.html ?? 'fragment',
    style: options.style ?? 'inline',
    assets: options.assets ?? 'inline',
    fonts: options.fonts ?? 'none',
    assetBasePath: options.assetBasePath ?? 'assets'
  }

  if (resolvedOptions.html === 'standalone') return exportStandaloneHTML(document, resolvedOptions)

  return {
    entrypoint: 'index.html',
    files: [
      { path: 'index.html', content: serializeHTML(document, { style: resolvedOptions.style }) }
    ]
  }
}
