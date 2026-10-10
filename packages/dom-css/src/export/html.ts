import { twirl } from 'twirlwind'

import type { DesignDocument, DesignElement, DesignNode, DesignText } from '../types'

export interface SerializeHTMLOptions {
  style?: 'inline' | 'tailwind'
  /** Custom properties declared in `@theme`; a `var()` naming one becomes its utility. */
  themeVariables?: readonly string[]
  /**
   * Put each child of an element that holds only elements on its own indented line, for code
   * people read. Text keeps its whitespace; whitespace between elements in a projected layer
   * changes nothing, since its children are placed by flex, grid, or absolute position.
   */
  indent?: boolean
}

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

export function splitWhitespace(value: string): string[] {
  const parts: string[] = []
  let current = ''
  for (const char of value) {
    if (char === ' ' || char === '\n' || char === '\t' || char === '\r' || char === '\f') {
      if (current.length > 0) parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current.length > 0) parts.push(current)
  return parts
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;')
}

function serializeText(node: DesignText): string {
  return escapeText(node.text)
}

function serializeStyle(node: DesignElement): string | undefined {
  if (!node.inlineStyle || Object.keys(node.inlineStyle).length === 0) return undefined
  return Object.entries(node.inlineStyle)
    .filter(([, value]) => value !== '')
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ')
}

export function serializeTailwindClasses(
  node: DesignElement,
  themeVariables: readonly string[] = []
): string | undefined {
  const style = serializeStyle(node)
  if (!style) return undefined
  const className = twirl(style, { theme: { variables: themeVariables } })
  return className.length > 0 ? className : undefined
}

export function mergeClassNames(...values: Array<string | undefined>): string | undefined {
  const className = values
    .flatMap((value) => (value ? splitWhitespace(value) : []))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' ')
  return className.length > 0 ? className : undefined
}

function serializeAttrs(node: DesignElement, options: SerializeHTMLOptions): string {
  const style = serializeStyle(node)
  const tailwindClass =
    options.style === 'tailwind'
      ? serializeTailwindClasses(node, options.themeVariables)
      : undefined
  const attrsWithoutStyle = { ...node.attrs }
  delete attrsWithoutStyle.style
  const sourceAttrs = options.style === 'tailwind' && tailwindClass ? attrsWithoutStyle : node.attrs
  const attrs: Record<string, string | undefined> = { ...sourceAttrs }
  if (tailwindClass) attrs.class = mergeClassNames(node.attrs.class, tailwindClass)
  if (style && options.style !== 'tailwind') attrs.style = style
  const serialized = Object.entries(attrs)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
    .map(([name, value]) => `${name}="${escapeAttr(value)}"`)

  if (serialized.length === 0) return ''
  return ` ${serialized.join(' ')}`
}

/** Static HTML cannot play a shader, so its layer shows the still frame behind its content. */
const SHADER_FRAME_STYLE =
  'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;border-radius:inherit;pointer-events:none'

function shaderFrame(node: DesignElement): string {
  const frame = node.shader?.frame
  return frame ? `<img src="${escapeAttr(frame)}" alt="" style="${SHADER_FRAME_STYLE}">` : ''
}

function serializeElement(
  node: DesignElement,
  options: SerializeHTMLOptions,
  depth: number
): string {
  // SVG names such as `linearGradient` keep their case, as an SVG parser needs them.
  const tagName = node.tagName
  const attrs = serializeAttrs(node, options)
  if (VOID_ELEMENTS.has(tagName.toLowerCase())) return `<${tagName}${attrs}>`
  const children = [
    shaderFrame(node),
    ...node.children.map((child) => serializeNode(child, options, depth + 1))
  ].filter((child) => child !== '')
  const block =
    options.indent && children.length > 0 && node.children.every((child) => child.type !== 'text')
  if (!block) return `<${tagName}${attrs}>${children.join('')}</${tagName}>`
  const inner = '  '.repeat(depth + 1)
  const outer = '  '.repeat(depth)
  return `<${tagName}${attrs}>\n${children.map((child) => inner + child).join('\n')}\n${outer}</${tagName}>`
}

export function serializeNode(
  node: DesignNode,
  options: SerializeHTMLOptions = {},
  depth = 0
): string {
  return node.type === 'text' ? serializeText(node) : serializeElement(node, options, depth)
}

export function serializeHTML(
  document: DesignDocument,
  options: SerializeHTMLOptions = {}
): string {
  const resolved: SerializeHTMLOptions = {
    ...options,
    themeVariables: options.themeVariables ?? document.tokens?.themeVariables()
  }
  return document.children
    .map((node) => serializeNode(node, resolved))
    .join(options.indent ? '\n' : '')
}
