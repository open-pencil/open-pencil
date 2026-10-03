import { jsx, type SyntaxNode } from '@open-pencil/codegen'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { collectProps, NODE_TYPE_TO_TAG, type JSXProp } from './props'
import { valueSyntax } from './value'

function propValue(value: JSXProp[1]): SyntaxNode | null {
  if (value === true) return null
  if (typeof value === 'string') return jsx.stringValue(value)
  return jsx.container(valueSyntax(value))
}

/**
 * A prop as a JSX attribute: `true` prints the bare name, strings as attribute strings, and
 * other values as expressions, with paint and effect helpers as calls.
 */
function propAttribute([name, value]: JSXProp): SyntaxNode {
  return jsx.attribute(name, propValue(value))
}

/** Design JSX with the layer behind each element, in the order elements open. */
export interface DesignJSXWithLayers {
  code: string
  /** One id per JSX element, in pre-order, so editors can link elements to layers. */
  layerIds: string[]
}

function nodeToJSX(
  node: SceneNode,
  graph: SceneGraph,
  depth: number,
  layerIds?: string[]
): SyntaxNode | null {
  const tag = NODE_TYPE_TO_TAG[node.type]
  if (!tag) return null
  layerIds?.push(node.id)
  const attributes = collectProps(node, graph).map(propAttribute)
  if (node.type === 'TEXT') {
    return jsx.element(tag, attributes, node.text ? [jsx.text(node.text)] : [], depth, true)
  }
  // Hidden children export with `visible={false}` rather than disappearing.
  const children = graph
    .getChildren(node.id)
    .flatMap((child) => nodeToJSX(child, graph, depth + 1, layerIds) ?? [])
  return jsx.element(tag, attributes, children, depth)
}

/** A JSX attribute as the export prints it: its name and its source, such as `w={320}`. */
export interface JSXAttributeSource {
  name: string
  source: string
}

/** Printed values break lines only between tokens, never inside a string, so joining is lossless. */
function oneLine(source: string): string {
  return source.replace(/\s*\n\s*/g, ' ')
}

/**
 * The attributes `sceneNodeToJSX` prints for a node, each on one line, with a text node's
 * content as a `text` attribute. `null` for a node the export does not write.
 */
export function sceneNodeAttributes(
  nodeId: string,
  graph: SceneGraph
): JSXAttributeSource[] | null {
  const node = graph.getNode(nodeId)
  if (!node || !NODE_TYPE_TO_TAG[node.type]) return null
  const props = collectProps(node, graph)
  if (node.type === 'TEXT') props.push(['text', node.text])
  return props.map((prop) => ({
    name: prop[0],
    source: oneLine(jsx.printJSX(propAttribute(prop)))
  }))
}

/**
 * One layer as Design JSX writes it, so an editor can patch the code a person has edited
 * instead of writing it again.
 */
export interface DesignJSXElement {
  tag: string
  /** Each attribute as `sceneNodeAttributes` prints it, keyed by name: `w={320}`. */
  attributes: Record<string, string>
  /** Text content of a text layer as JSX writes it, else `null`. */
  text: string | null
  /** The layers written as child elements, in order. */
  childIds: string[]
}

export function designJSXElement(nodeId: string, graph: SceneGraph): DesignJSXElement | null {
  const node = graph.getNode(nodeId)
  const tag = node && NODE_TYPE_TO_TAG[node.type]
  const printed = sceneNodeAttributes(nodeId, graph)
  if (!node || !tag || !printed) return null
  // A text layer's content is written as its children, not as the `text` attribute.
  const isText = node.type === 'TEXT'
  const attributes = Object.fromEntries(
    printed
      .filter(({ name }) => !isText || name !== 'text')
      .map(({ name, source }) => [name, source])
  )
  if (isText) {
    const text = node.text ? jsx.printJSX(jsx.text(node.text)) : null
    return { tag, attributes, text, childIds: [] }
  }
  const childIds = graph
    .getChildren(node.id)
    .filter((child) => NODE_TYPE_TO_TAG[child.type])
    .map((child) => child.id)
  return { tag, attributes, text: null, childIds }
}

export function sceneNodeToJSX(nodeId: string, graph: SceneGraph): string {
  const node = graph.getNode(nodeId)
  const syntax = node ? nodeToJSX(node, graph, 0) : null
  return syntax ? jsx.printJSX(syntax) : ''
}

export function selectionToJSX(nodeIds: string[], graph: SceneGraph): string {
  return selectionToJSXWithLayers(nodeIds, graph).code
}

export function selectionToJSXWithLayers(
  nodeIds: string[],
  graph: SceneGraph
): DesignJSXWithLayers {
  const layerIds: string[] = []
  const code = nodeIds
    .map((id) => {
      const node = graph.getNode(id)
      const syntax = node ? nodeToJSX(node, graph, 0, layerIds) : null
      return syntax ? jsx.printJSX(syntax) : ''
    })
    .filter(Boolean)
    .join('\n\n')
  return { code, layerIds }
}
