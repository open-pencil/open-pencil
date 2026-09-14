import type { SyntaxNode } from '@lezer/common'
import { decodeHTML } from 'entities'

import { DESIGN_JSX_ELEMENTS } from '#core/design-jsx/schema'
import type { TreeNode } from '#core/design-jsx/tree'

import { readLiteral } from './literals'

const ELEMENT_TYPES = new Map(
  DESIGN_JSX_ELEMENTS.map(({ name, runtimeType }) => [name, runtimeType])
)
const MAX_PREVIEW_DEPTH = 100
const MAX_PREVIEW_NODES = 10_000

export interface JSXPreviewNode extends TreeNode {
  /** Stable identity within an append-only source stream; not a permanent scene node ID. */
  sourceStart: number
  children: (JSXPreviewNode | string)[]
}

export interface JSXPreviewPending {
  from: number
  to: number
  reason: 'incomplete' | 'unsupported'
}

export interface JSXPreviewSnapshot {
  tree: JSXPreviewNode | null
  pending: JSXPreviewPending[]
}

function children(node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child)
  return result
}

function hasError(node: SyntaxNode): boolean {
  let error = false
  node.cursor().iterate((child) => {
    if (child.type.isError) error = true
    return !error
  })
  return error
}

/** Match JSX's line-oriented whitespace handling, rather than HTML whitespace collapsing. */
function textValue(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/)
  const lastNonEmpty = lines.findLastIndex((line) => /[^ \t]/.test(line))
  return lines
    .map((line, index) => {
      let value = line.replaceAll('\t', ' ')
      if (index > 0) value = value.replace(/^ +/, '')
      if (index < lines.length - 1) value = value.replace(/ +$/, '')
      return value && index < lastNonEmpty ? `${value} ` : value
    })
    .join('')
}

export function projectPreview(root: SyntaxNode, source: string): JSXPreviewSnapshot {
  const pending: JSXPreviewPending[] = []
  let nodeCount = 0
  const raw = (node: SyntaxNode) => source.slice(node.from, node.to)
  const defer = (node: SyntaxNode, reason: JSXPreviewPending['reason']) => {
    pending.push({ from: node.from, to: node.to, reason })
  }

  function expression(node: SyntaxNode) {
    if (hasError(node) || !raw(node).endsWith('}')) {
      defer(node, 'incomplete')
      return null
    }
    const value = readLiteral(raw(node).slice(1, -1))
    if (!value) defer(node, 'unsupported')
    return value
  }

  function attributes(opening: SyntaxNode): Record<string, unknown> | null {
    const props: Record<string, unknown> = {}
    for (const attribute of children(opening)) {
      if (attribute.name === 'JSXSpreadAttribute') {
        // A spread can change any prop, so don't guess the element's appearance.
        defer(attribute, 'unsupported')
        return null
      }
      if (attribute.name !== 'JSXAttribute') continue
      const keyNode = attribute.firstChild
      if (keyNode?.name !== 'JSXIdentifier') {
        defer(attribute, 'unsupported')
        continue
      }
      const key = raw(keyNode)
      const valueNode = attribute.lastChild
      let value: unknown = true
      if (valueNode && valueNode !== keyNode && valueNode.from !== keyNode.from) {
        if (valueNode.name === 'JSXAttributeValue') {
          value = decodeHTML(
            raw(valueNode)
              .slice(1, -1)
              .replace(/\r\n|[\r\n\t]/g, ' ')
          )
        } else if (valueNode.name === 'JSXEscape') {
          const literal = expression(valueNode)
          if (!literal) continue
          value = literal.value
        } else {
          defer(attribute, 'unsupported')
          continue
        }
      }
      // defineProperty handles __proto__ as data, never as a prototype mutation.
      Object.defineProperty(props, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      })
    }
    return props
  }

  function element(node: SyntaxNode, depth: number): JSXPreviewNode | null {
    if (depth > MAX_PREVIEW_DEPTH || ++nodeCount > MAX_PREVIEW_NODES) {
      throw new RangeError('JSX preview tree limit exceeded')
    }
    const opening = node.firstChild
    if (!opening || !['JSXOpenTag', 'JSXSelfClosingTag', 'JSXFragmentTag'].includes(opening.name)) {
      defer(node, 'unsupported')
      return null
    }
    // Recovery can synthesize a self-closing tag without an authored />.
    const delimiter = opening.lastChild
    if (hasError(opening) || !delimiter || !['>', '/>'].includes(raw(delimiter))) {
      defer(opening, 'incomplete')
      return null
    }
    const tagName = opening.getChild('JSXIdentifier') ?? opening.getChild('JSXBuiltin')
    const fragment = raw(opening) === '<>'
    const name = tagName ? raw(tagName) : ''
    const type = fragment
      ? ''
      : (ELEMENT_TYPES.get(name) ?? (/^[a-z][\w-]*$/.test(name) ? name : null))
    if (type === null) {
      defer(opening, 'unsupported')
      return null
    }
    const props = attributes(opening)
    if (!props) return null
    const result: JSXPreviewNode = { type, props, children: [], sourceStart: node.from }
    appendChildren(node, result, depth)
    return result
  }

  function appendChildren(node: SyntaxNode, result: JSXPreviewNode, depth: number): void {
    for (const child of children(node).slice(1)) {
      if (child.name === 'JSXElement') {
        const projected = element(child, depth + 1)
        if (projected) result.children.push(projected)
      } else if (child.name === 'JSXText') {
        let value = raw(child)
        if (child.to === source.length) {
          // Don't flash a partial entity or a split UTF-16 surrogate as literal text.
          value = value.replace(/&(?:#x?[\da-f]*|[a-z]*)$/i, '').replace(/[\uD800-\uDBFF]$/, '')
        }
        value = decodeHTML(textValue(value))
        if (value) result.children.push(value)
      } else if (child.name === 'JSXEscape') {
        const literal = expression(child)
        if (literal && (typeof literal.value === 'string' || typeof literal.value === 'number')) {
          result.children.push(String(literal.value))
        } else if (literal && typeof literal.value === 'object' && literal.value !== null) {
          defer(child, 'unsupported')
        }
      } else if (child.type.isError || hasError(child)) {
        defer(child, 'incomplete')
      }
    }
  }

  const first = root.firstChild
  if (!first) return { tree: null, pending }
  if (first.name !== 'JSXElement') {
    defer(first, hasError(root) ? 'incomplete' : 'unsupported')
    return { tree: null, pending }
  }
  return { tree: element(first, 0), pending }
}
