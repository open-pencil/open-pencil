import type { ElementNode, Node } from 'comark'

import { appendAll } from '@open-pencil/scene-graph/arrays'

/** The class of a word that fades in as a reply streams (`src/theme/markdown/markdown.css`). */
export const STREAMING_WORD_CLASS = 'markdown-word'

/** Code keeps its text whole: its block and lines fade in as units. */
const WHOLE_TEXT_TAGS: ReadonlySet<string> = new Set(['pre', 'code'])

const WORDS = /(\s+)/

/** Each element `animateWords` rebuilt, to the element as parsed. */
const parsedElements = new WeakMap<ElementNode, ElementNode>()

function wordNodes(text: string): Node[] {
  const nodes: Node[] = []
  for (const part of text.split(WORDS)) {
    if (!part) continue
    nodes.push(/^\s+$/.test(part) ? part : ['span', { class: STREAMING_WORD_CLASS }, part])
  }
  return nodes
}

function animateNode(node: Node): Node[] {
  if (typeof node === 'string') return wordNodes(node)
  const [tag, attributes, ...children] = node
  if (tag === null || WHOLE_TEXT_TAGS.has(tag)) return [node]
  const element: ElementNode = [tag, attributes]
  for (const child of children) appendAll(element, animateNode(child))
  parsedElements.set(element, node)
  return [element]
}

/**
 * The document with every word of its text in its own element, for a reply that is streaming.
 * The renderer keys children by position and new text arrives at the end, so a word already
 * shown keeps its element and only the words that just arrived mount and fade in. The settled
 * reply renders its plain nodes, which drops these elements without animating anything again.
 */
export function animateWords(nodes: readonly Node[]): Node[] {
  return nodes.flatMap(animateNode)
}

/** The element as parsed, without the word elements a streaming reply renders it with. */
export function parsedElement(element: ElementNode): ElementNode {
  return parsedElements.get(element) ?? element
}
