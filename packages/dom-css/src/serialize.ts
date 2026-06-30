import type { DesignDocument, DesignElement, DesignNode, DesignText } from './types'

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

function serializeAttrs(node: DesignElement): string {
  const style = serializeStyle(node)
  const attrs = Object.entries({ ...node.attrs, ...(style ? { style } : {}) })
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}="${escapeAttr(value)}"`)

  if (attrs.length === 0) return ''
  return ` ${attrs.join(' ')}`
}

function serializeElement(node: DesignElement): string {
  const tagName = node.tagName.toLowerCase()
  const attrs = serializeAttrs(node)
  if (VOID_ELEMENTS.has(tagName)) return `<${tagName}${attrs}>`
  return `<${tagName}${attrs}>${node.children.map(serializeNode).join('')}</${tagName}>`
}

export function serializeNode(node: DesignNode): string {
  return node.type === 'text' ? serializeText(node) : serializeElement(node)
}

export function serializeHTML(document: DesignDocument): string {
  return document.children.map(serializeNode).join('')
}
