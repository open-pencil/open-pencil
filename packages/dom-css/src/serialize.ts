import { twirl } from 'twirlwind'

import type { DesignDocument, DesignElement, DesignNode, DesignText } from './types'

export interface SerializeHTMLOptions {
  style?: 'inline' | 'tailwind'
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

function serializeTailwindClasses(node: DesignElement): string | undefined {
  const style = serializeStyle(node)
  if (!style) return undefined
  const className = twirl(style)
  return className.length > 0 ? className : undefined
}

function mergeClassNames(...values: Array<string | undefined>): string | undefined {
  const className = values
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' ')
  return className.length > 0 ? className : undefined
}

function serializeAttrs(node: DesignElement, options: SerializeHTMLOptions): string {
  const style = serializeStyle(node)
  const tailwindClass = options.style === 'tailwind' ? serializeTailwindClasses(node) : undefined
  const attrsWithoutStyle = { ...node.attrs }
  delete attrsWithoutStyle.style
  const sourceAttrs = options.style === 'tailwind' && tailwindClass ? attrsWithoutStyle : node.attrs
  const attrs = {
    ...sourceAttrs,
    ...(tailwindClass ? { class: mergeClassNames(node.attrs.class, tailwindClass) } : {}),
    ...(style && options.style !== 'tailwind' ? { style } : {})
  }
  const serialized = Object.entries(attrs)
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}="${escapeAttr(value)}"`)

  if (serialized.length === 0) return ''
  return ` ${serialized.join(' ')}`
}

function serializeElement(node: DesignElement, options: SerializeHTMLOptions): string {
  const tagName = node.tagName.toLowerCase()
  const attrs = serializeAttrs(node, options)
  if (VOID_ELEMENTS.has(tagName)) return `<${tagName}${attrs}>`
  return `<${tagName}${attrs}>${node.children.map((child) => serializeNode(child, options)).join('')}</${tagName}>`
}

export function serializeNode(node: DesignNode, options: SerializeHTMLOptions = {}): string {
  return node.type === 'text' ? serializeText(node) : serializeElement(node, options)
}

export function serializeHTML(
  document: DesignDocument,
  options: SerializeHTMLOptions = {}
): string {
  return document.children.map((node) => serializeNode(node, options)).join('')
}
