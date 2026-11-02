import { decodeHTML } from 'entities'
import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5'

import type { FlowLabel } from './flowchart/model'
import { decodeEntities } from './upstream/preprocess'

/** A label as Mermaid's grammar hands it over: its text, and how that text is to be read. */
export interface GrammarText {
  text: string
  type: string
}

type HTMLNode = DefaultTreeAdapterTypes.ChildNode

/** The text HTML shows: its text nodes, and a line break for each `<br>`. */
function shownText(nodes: HTMLNode[]): string {
  return nodes
    .map((node) => {
      if (node.nodeName === '#text' && 'value' in node) return node.value
      if (node.nodeName === 'br') return '\n'
      return 'childNodes' in node ? shownText(node.childNodes) : ''
    })
    .join('')
}

/**
 * A label's text as plain text and its format. Mermaid draws a label as HTML, so its tags only
 * style the text, `<br>` breaks the line, and entities stand for characters. Markdown, written
 * in backticks, keeps its marks for whoever draws it.
 */
export function readLabel(label: GrammarText): FlowLabel {
  let text = decodeEntities(label.text.trim())
  // Mermaid drops the quotes around a label written in them.
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1)
  if (label.type === 'markdown') return { text: decodeHTML(text), format: 'markdown' }
  return { text: shownText(parseFragment(text).childNodes), format: 'text' }
}
