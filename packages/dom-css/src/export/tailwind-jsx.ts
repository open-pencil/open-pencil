import { jsx, type SyntaxNode } from '@open-pencil/codegen'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { DesignDocument, DesignElement, DesignNode } from '../types'
import { mergeClassNames, serializeTailwindClasses } from './html'
import { sceneNodeToDesignDocument } from './projection'

/** HTML attribute names that JSX spells differently. */
const JSX_ATTRIBUTE_NAMES: Record<string, string> = { class: 'className', for: 'htmlFor' }

/** Scene text layers become paragraphs; Tailwind's preflight removes their margins. */
function tagName(node: DesignElement): string {
  return node.sourceSceneNode?.type === 'TEXT' ? 'p' : node.tagName
}

function attributes(node: DesignElement): SyntaxNode[] {
  const { class: className, ...attrs } = node.attrs
  const name = node.sourceSceneNode?.name
  const entries: [string, string | undefined][] = [
    ['data-name', name && name !== node.sourceSceneNode?.type ? name : undefined],
    ...Object.entries(attrs),
    ['className', mergeClassNames(className, serializeTailwindClasses(node))]
  ]
  return entries.flatMap(([key, value]) =>
    value === undefined
      ? []
      : [jsx.attribute(JSX_ATTRIBUTE_NAMES[key] ?? key, jsx.stringValue(value))]
  )
}

function element(node: DesignElement, depth: number): SyntaxNode {
  const children = node.children.map((child) => jsxNode(child, depth + 1))
  // A lone text child stays on the element's line.
  const inline = children.length === 1 && node.children[0]?.type === 'text'
  return jsx.element(tagName(node), attributes(node), children, depth, inline)
}

function jsxNode(node: DesignNode, depth: number): SyntaxNode {
  return node.type === 'text' ? jsx.text(node.text) : element(node, depth)
}

/** Print a design document as Tailwind JSX, one top-level element per block. */
export function designDocumentToTailwindJSX(document: DesignDocument): string {
  return document.children.map((node) => jsx.printJSX(jsxNode(node, 0))).join('\n\n')
}

/** Tailwind JSX for scene nodes, separated by blank lines. */
export function sceneNodesToTailwindJSX(graph: SceneGraph, nodeIds: string[]): string {
  return nodeIds
    .map((id) => designDocumentToTailwindJSX(sceneNodeToDesignDocument(graph, id, false)))
    .filter(Boolean)
    .join('\n\n')
}
