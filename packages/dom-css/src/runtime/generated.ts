import valueParser from 'postcss-value-parser'

import type { DesignElement } from '../types'
import { CounterState } from './counters'

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
 * The text a computed `content` value shows: its strings, the attributes it names, and its
 * counters as they stand, in order. Null for `none` and `normal`, which generate no box; quotes and
 * images add no text.
 */
export function generatedText(
  content: string,
  element: Element,
  counters: CounterState
): string | null {
  if (content === 'none' || content === 'normal') return null
  let text = ''
  for (const node of valueParser(content).nodes) {
    if (node.type === 'string') text += node.value
    else if (node.type === 'function') {
      const name = node.value.toLowerCase()
      if (name === 'attr') text += element.getAttribute(node.nodes.at(0)?.value ?? '') ?? ''
      else if (name === 'counter' || name === 'counters') text += counters.text(node)
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

/** Shows one pseudo-element of `domElement` as an element of its own; returns whether it did. */
function showPseudoElement(
  pseudo: (typeof PSEUDO_ELEMENTS)[number],
  designElement: DesignElement,
  domElement: Element,
  view: Window,
  counters: CounterState,
  pairs: [DesignElement, Element][]
): boolean {
  const style = view.getComputedStyle(domElement, `::${pseudo}`)
  if (style.content === 'none' || style.content === 'normal' || style.display === 'none') {
    return false
  }
  // A pseudo-element's own counters apply first, so `content: counter(step)` beside
  // `counter-increment: step` shows the step it counts.
  counters.apply(style, domElement)
  const text = generatedText(style.content, domElement, counters) ?? ''
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
  return true
}

/**
 * Shows each paired element's `::before` and `::after` as elements of their own, in the sandbox and
 * in the document, so they are laid out, styled, and imported as any element is: a box with its
 * pseudo-element's computed style and text, first or last among the element's children, named
 * `::before` or `::after`. The sandbox is walked in document order, so CSS counters count as the
 * page counts them. The pseudo-elements themselves are switched off so nothing shows twice. Adds
 * the pairs it makes to `pairs`, and returns how many it made.
 */
export function showGeneratedContent(
  pairs: [DesignElement, Element][],
  view: Window,
  styleRoot: Node & ParentNode,
  root: Element
): number {
  const designElements = new Map(pairs.map(([design, dom]) => [dom, design]))
  const counters = new CounterState()
  let made = 0
  const visit = (domElement: Element) => {
    const style = view.getComputedStyle(domElement)
    // An element that is not rendered, nor anything in it, counts nothing.
    if (style.display === 'none') return
    const parent = domElement.parentElement === root ? null : domElement.parentElement
    counters.apply(style, parent)
    // The children as the page has them, before any generated box joins them.
    const children = Array.from(domElement.children)
    const designElement = designElements.get(domElement)
    const shows = designElement !== undefined && !REPLACED_TAGS.has(domElement.localName)
    if (shows && showPseudoElement('before', designElement, domElement, view, counters, pairs))
      made++
    for (const child of children) visit(child)
    if (shows && showPseudoElement('after', designElement, domElement, view, counters, pairs))
      made++
    counters.leave(domElement)
  }
  // The counters the root and the elements around it start, such as `body { counter-reset }`,
  // from the outermost in, up to the measuring frame's root.
  const around: Element[] = []
  for (let element: Element | null = root; element; element = element.parentElement) {
    around.unshift(element)
  }
  for (const element of around) counters.apply(view.getComputedStyle(element), null)
  for (const child of Array.from(root.children)) visit(child)
  if (made > 0) {
    const off = styleRoot.ownerDocument?.createElement('style')
    if (off) {
      off.textContent = `[${GENERATED_ATTRIBUTE}]::before,[${GENERATED_ATTRIBUTE}]::after{content:none!important}`
      styleRoot.append(off)
    }
  }
  return made
}
