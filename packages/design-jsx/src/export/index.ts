import { jsx, type SyntaxNode } from '@open-pencil/emit'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { collectProps, NODE_TYPE_TO_TAG, type JSXProp } from './props'

function propValue(value: JSXProp[1]): SyntaxNode | null {
  if (value === true) return null
  if (typeof value === 'string') return jsx.stringValue(value)
  if (Array.isArray(value)) {
    return jsx.container({
      type: 'ArrayExpression',
      elements: value.map((item) => jsx.literal(item))
    })
  }
  return jsx.container(jsx.literal(value))
}

/** A prop as a JSX attribute: `true` prints the bare name, other values as typed literals. */
function propAttribute([name, value]: JSXProp): SyntaxNode {
  return jsx.attribute(name, propValue(value))
}

function nodeToJSX(node: SceneNode, graph: SceneGraph, depth: number): SyntaxNode | null {
  const tag = NODE_TYPE_TO_TAG[node.type]
  if (!tag) return null
  const attributes = collectProps(node, graph).map(propAttribute)
  if (node.type === 'TEXT') {
    return jsx.element(tag, attributes, node.text ? [jsx.text(node.text)] : [], depth, true)
  }
  const children = graph
    .getChildren(node.id)
    .filter((child) => child.visible)
    .flatMap((child) => nodeToJSX(child, graph, depth + 1) ?? [])
  return jsx.element(tag, attributes, children, depth)
}

export function sceneNodeToJSX(nodeId: string, graph: SceneGraph): string {
  const node = graph.getNode(nodeId)
  const syntax = node ? nodeToJSX(node, graph, 0) : null
  return syntax ? jsx.printJSX(syntax) : ''
}

export function selectionToJSX(nodeIds: string[], graph: SceneGraph): string {
  return nodeIds
    .map((id) => sceneNodeToJSX(id, graph))
    .filter(Boolean)
    .join('\n\n')
}
