import type { DesignElement, DesignNode } from '../types'

export function textContent(node: DesignNode): string {
  if (node.type === 'text') return node.text
  return node.children.map(textContent).join('')
}

export function isTextLikeElement(node: DesignElement): boolean {
  return [
    'span',
    'p',
    'label',
    'strong',
    'em',
    'button',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6'
  ].includes(node.tagName.toLowerCase())
}

export function hasContent(element: DesignElement): boolean {
  return element.children.some((child) => child.type !== 'text' || child.text.trim().length > 0)
}
