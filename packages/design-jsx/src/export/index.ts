import { compact } from 'es-toolkit/array'

import { jsx, type SyntaxNode } from '@open-pencil/emit'
import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { elementTag } from '../elements'
import { stickyBody, stickyName, stickyProps } from '../stickies'
import { rekaExport, type RekaExport } from './behaviours'
import { iconProps } from './icons'
import { collectProps, positionProps } from './props'
import { textChildren } from './text'
import { plainValue, propAttribute, type JSXProp } from './value'

/** Design JSX with the layer behind each element, in the order elements open. */
export interface DesignJSXWithLayers {
  code: string
  /**
   * One entry per JSX element, in pre-order, so editors can link elements to layers: the
   * layer's id, or `null` for an element no layer is, such as a `<Span>` or `<Paragraph>`.
   */
  layerIds: Array<string | null>
}

const NO_REKA: RekaExport = { tags: new Map(), props: new Map(), flatten: new Set() }

function mergeReka(outer: RekaExport, inner: RekaExport | null): RekaExport {
  if (!inner) return outer
  return {
    tags: new Map([...outer.tags, ...inner.tags]),
    props: new Map([...outer.props, ...inner.props]),
    flatten: new Set([...outer.flatten, ...inner.flatten])
  }
}

/** How many JSX elements the syntax holds, as an editor finds them in pre-order. */
function elementCount(nodes: readonly SyntaxNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type !== 'JSXElement') continue
    const children = (node as { children?: SyntaxNode[] }).children ?? []
    count += 1 + elementCount(children)
  }
  return count
}

/**
 * A layer and the layers below it as JSX elements. A component with a behaviour is written as
 * Reka UI elements; a container JSX leaves implicit is written as its children alone.
 */
/** What an element written its own way holds: its props, and the text it writes as children. */
interface OwnElement {
  props: JSXProp[]
  text: string
}

/** The layers whose elements take props of their own rather than the layer props. */
const OWN_ELEMENTS: Partial<Record<NodeType, (graph: SceneGraph, node: SceneNode) => OwnElement>> =
  {
    STICKY: (graph, node) => {
      const name = stickyName(graph, node)
      return {
        props: [
          ...(name ? [['name', name] satisfies JSXProp] : []),
          ...positionProps(node, graph),
          ...stickyProps(graph, node).map(([key, value]): JSXProp => [key, plainValue(value)])
        ],
        text: stickyBody(graph, node)
      }
    }
  }

function nodeToJSX(
  node: SceneNode,
  graph: SceneGraph,
  depth: number,
  layerIds?: Array<string | null>,
  outer: RekaExport = NO_REKA
): SyntaxNode[] {
  const reka = mergeReka(outer, rekaExport(graph, node))
  // Hidden children export with `visible={false}` rather than disappearing.
  const children = (childDepth: number) =>
    graph
      .getChildren(node.id)
      .flatMap((child) => nodeToJSX(child, graph, childDepth, layerIds, reka))
  if (reka.flatten.has(node.id)) return children(depth)
  // An icon is written by name; its paths are the icon set's to draw again.
  const icon = iconProps(node, graph)
  if (icon) {
    layerIds?.push(node.id)
    return [jsx.element('Icon', icon.map(propAttribute), [], depth)]
  }
  const tag = reka.tags.get(node.id) ?? elementTag(node.type)
  if (!tag) return []
  layerIds?.push(node.id)
  const own = OWN_ELEMENTS[node.type]?.(graph, node)
  if (own) {
    const children = own.text ? [jsx.text(own.text)] : []
    return [jsx.element(tag, own.props.map(propAttribute), children, depth, true)]
  }
  const ownProps = reka.props.get(node.id)
  // An item names its component; the instance's own layers are the component's to write.
  if (ownProps?.some(([name]) => name === 'of'))
    return [jsx.element(tag, ownProps.map(propAttribute), [], depth)]
  const attributes = [...collectProps(node, graph), ...(ownProps ?? [])].map(propAttribute)
  if (node.type === 'TEXT') {
    const { children: content, inline } = textChildren(node, depth)
    for (let count = elementCount(content); count > 0; count--) layerIds?.push(null)
    return [jsx.element(tag, attributes, content, depth, inline)]
  }
  return [jsx.element(tag, attributes, children(depth + 1), depth)]
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
  if (!node || !elementTag(node.type)) return null
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
  /**
   * A text layer's content as JSX writes it between its tags, `<Span>`s and `<Paragraph>`s
   * included, for an element at the start of its line; `null` for no content or another layer.
   */
  text: string | null
  /** The layers written as child elements, in order. */
  childIds: string[]
}

/** What a text's element holds between its tags, printed as `sceneNodeToJSX` prints it. */
function textContent(node: SceneNode, tag: string): string | null {
  const { children, inline } = textChildren(node, 0)
  if (children.length === 0) return null
  const printed = jsx.printJSX(jsx.element(tag, [], children, 0, inline))
  return printed.slice(tag.length + 2, printed.lastIndexOf(`</${tag}>`))
}

export function designJSXElement(nodeId: string, graph: SceneGraph): DesignJSXElement | null {
  const node = graph.getNode(nodeId)
  const tag = node && elementTag(node.type)
  const printed = sceneNodeAttributes(nodeId, graph)
  if (!node || !tag || !printed) return null
  // A text layer's content is written as its children, not as the `text` attribute.
  const isText = node.type === 'TEXT'
  const attributes = Object.fromEntries(
    printed
      .filter(({ name }) => !isText || name !== 'text')
      .map(({ name, source }) => [name, source])
  )
  if (isText) return { tag, attributes, text: textContent(node, tag), childIds: [] }
  const childIds = graph
    .getChildren(node.id)
    .filter((child) => elementTag(child.type))
    .map((child) => child.id)
  return { tag, attributes, text: null, childIds }
}

export function sceneNodeToJSX(nodeId: string, graph: SceneGraph): string {
  const node = graph.getNode(nodeId)
  const syntax = node ? nodeToJSX(node, graph, 0).at(0) : undefined
  return syntax ? jsx.printJSX(syntax) : ''
}

export function selectionToJSX(nodeIds: string[], graph: SceneGraph): string {
  return selectionToJSXWithLayers(nodeIds, graph).code
}

export function selectionToJSXWithLayers(
  nodeIds: string[],
  graph: SceneGraph
): DesignJSXWithLayers {
  const layerIds: Array<string | null> = []
  const code = compact(
    nodeIds.map((id) => {
      const node = graph.getNode(id)
      const syntax = node ? nodeToJSX(node, graph, 0, layerIds).at(0) : undefined
      return syntax ? jsx.printJSX(syntax) : ''
    })
  ).join('\n\n')
  return { code, layerIds }
}
