import valueParser from 'postcss-value-parser'

import type { DesignElement } from '../types'

const PSEUDO_ELEMENTS = ['before', 'after'] as const

/** Marks an element whose generated content the sandbox shows as elements, its own switched off. */
const GENERATED_ATTRIBUTE = 'data-openpencil-generated'

/** Elements that show no generated content, as a browser draws none before or after them. */
const REPLACED_TAGS = new Set([
  'audio',
  'br',
  'canvas',
  'embed',
  'iframe',
  'img',
  'input',
  'object',
  'select',
  'textarea',
  'video'
])

/**
 * The text a computed `content` value shows: its strings and the attributes it names, in order.
 * Null for `none` and `normal`, which generate no box; counters, quotes, and images add no text.
 */
export function generatedText(content: string, element: Element): string | null {
  if (content === 'none' || content === 'normal') return null
  let text = ''
  for (const node of valueParser(content).nodes) {
    if (node.type === 'string') text += node.value
    else if (node.type === 'function' && node.value.toLowerCase() === 'attr') {
      text += element.getAttribute(node.nodes.at(0)?.value ?? '') ?? ''
    }
  }
  return text
}

/** A pseudo-element's computed style as an element's inline style; `content` is a pseudo-element's alone. */
function inlineStyle(style: CSSStyleDeclaration): string {
  return Array.from(style)
    .filter((property) => property !== 'content')
    .map((property) => `${property}:${style.getPropertyValue(property)}`)
    .join(';')
}

/**
 * Shows each paired element's `::before` and `::after` as elements of their own, in the sandbox and
 * in the document, so they are laid out, styled, and imported as any element is: a box with its
 * pseudo-element's computed style and text, first or last among the element's children, named
 * `::before` or `::after`. The pseudo-elements themselves are switched off so nothing shows twice.
 * Adds the pairs it makes to `pairs`, and returns how many it made.
 */
export function showGeneratedContent(
  pairs: [DesignElement, Element][],
  view: Window,
  styleRoot: Node & ParentNode
): number {
  let made = 0
  // Only the elements already paired: the boxes this adds have no generated content of their own.
  for (const [designElement, domElement] of pairs.slice()) {
    if (REPLACED_TAGS.has(domElement.localName)) continue
    for (const pseudo of PSEUDO_ELEMENTS) {
      const style = view.getComputedStyle(domElement, `::${pseudo}`)
      const text = generatedText(style.content, domElement)
      if (text === null || style.display === 'none') continue
      const box = domElement.ownerDocument.createElement('span')
      box.style.cssText = inlineStyle(style)
      if (text) box.textContent = text
      const generated: DesignElement = {
        type: 'element',
        tagName: `::${pseudo}`,
        attrs: {},
        children: text ? [{ type: 'text', text }] : []
      }
      if (pseudo === 'before') {
        domElement.prepend(box)
        designElement.children.unshift(generated)
      } else {
        domElement.append(box)
        designElement.children.push(generated)
      }
      domElement.setAttribute(GENERATED_ATTRIBUTE, '')
      pairs.push([generated, box])
      made++
    }
  }
  if (made > 0) {
    const off = styleRoot.ownerDocument?.createElement('style')
    if (off) {
      off.textContent = `[${GENERATED_ATTRIBUTE}]::before,[${GENERATED_ATTRIBUTE}]::after{content:none!important}`
      styleRoot.append(off)
    }
  }
  return made
}
