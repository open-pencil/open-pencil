import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5'

import { computeHeadlessStyles } from '../headless-css'
import { serializeHTML } from '../serialize'
import { parseStyleAttribute } from '../style-attribute'
import type { CSSRuntime, DesignDocument, DesignElement, DesignNode } from '../types'

function attrsToRecord(attrs: DefaultTreeAdapterTypes.Element['attrs']): Record<string, string> {
  const result: Record<string, string> = {}
  for (const attr of attrs) result[attr.name] = attr.value
  return result
}

function isTextNode(
  node: DefaultTreeAdapterTypes.ChildNode
): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === '#text'
}

const NON_RENDERED_TAGS = new Set(['head', 'link', 'meta', 'script', 'style', 'template', 'title'])

function childToDesignNode(node: DefaultTreeAdapterTypes.ChildNode): DesignNode | null {
  if (isTextNode(node)) {
    return node.value.trim().length > 0 ? { type: 'text', text: node.value } : null
  }

  if (!('tagName' in node)) return null
  if (NON_RENDERED_TAGS.has(node.tagName.toLowerCase())) return null

  const attrs = attrsToRecord(node.attrs)
  const element: DesignElement = {
    type: 'element',
    tagName: node.tagName.toLowerCase(),
    attrs,
    children: node.childNodes
      .map(childToDesignNode)
      .filter((child): child is DesignNode => child !== null)
  }

  const inlineStyle = parseStyleAttribute(attrs.style)
  if (inlineStyle) element.inlineStyle = inlineStyle

  return element
}

function parseHTML(html: string): DesignDocument {
  const fragment = parseFragment(html)
  return {
    type: 'document',
    children: fragment.childNodes
      .map(childToDesignNode)
      .filter((node): node is DesignNode => node !== null)
  }
}

export function createHeadlessCSSRuntime(): CSSRuntime {
  return {
    kind: 'headless',
    parseHTML,
    serializeHTML(document: DesignDocument) {
      return serializeHTML(document)
    },
    async computeStyles(document: DesignDocument, cssText = '') {
      return computeHeadlessStyles(document, cssText)
    }
  }
}
