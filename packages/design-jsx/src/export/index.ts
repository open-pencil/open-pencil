import { compact } from 'es-toolkit'

import { jsx, type SyntaxNode } from '@open-pencil/emit'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { isGeneratedFrame, type GeneratedFrameType } from '@open-pencil/scene-graph/generated'

import { rekaExport, type RekaExport } from '../behaviours/export'
import { elementTag } from '../elements'
import {
  connectorExportScope,
  connectorLabel,
  connectorProps,
  type ConnectorExportScope
} from '../figjam/connectors'
import { shapeWithTextLabelText, shapeWithTextProps } from '../figjam/shapes-with-text'
import { stickyBody, stickyProps } from '../figjam/stickies'
import { refDeclarations } from '../refs'
import { instanceProps } from './components/instances'
import { propertyBindingProps, withPropertyBindings } from './components/properties'
import {
  componentReferences,
  componentRefs,
  type ComponentReference
} from './components/references'
import { iconProps } from './icons'
import { collectProps, positionProps, presenceProps } from './props'
import { textChildren } from './text'
import { plainValue, propAttribute, Reference, type JSXProp } from './value'
import { variableExport, variableReferences, type VariableExport } from './variables'

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

/**
 * The name an element named by its text writes: none while the layer still follows its text, and
 * its name once renamed, even to its text, so reading it back keeps the name from following it.
 */
function textNamedName(node: SceneNode): JSXProp[] {
  return node.autoRename ? [] : [['name', node.name]]
}

/**
 * The layers whose elements take props of their own rather than the layer props: every generated
 * frame, whose sublayers its element writes as props and text.
 */
const OWN_ELEMENTS: Record<
  GeneratedFrameType,
  (graph: SceneGraph, node: SceneNode, scope?: ConnectorExportScope) => OwnElement
> = {
  STICKY: (graph, node) => ({
    props: [
      ...textNamedName(node),
      ...positionProps(node, graph),
      ...stickyProps(graph, node).map(([key, value]): JSXProp => [key, plainValue(value)]),
      ...presenceProps(node)
    ],
    text: stickyBody(graph, node)
  }),
  SHAPE_WITH_TEXT: (graph, node) => ({
    props: [
      ...textNamedName(node),
      ...positionProps(node, graph),
      ...shapeWithTextProps(graph, node),
      ...presenceProps(node)
    ],
    text: shapeWithTextLabelText(graph, node)
  }),
  CONNECTOR: (graph, node, scope) => ({
    props: connectorProps(graph, node, scope).map(([key, value]): JSXProp => [
      key,
      plainValue(value)
    ]),
    text: connectorLabel(graph, node)
  })
}

/** What a layer whose element takes props of its own writes, or undefined for another layer. */
function ownElement(
  graph: SceneGraph,
  node: SceneNode,
  scope?: ConnectorExportScope
): OwnElement | undefined {
  if (!isGeneratedFrame(node)) return undefined
  const own = OWN_ELEMENTS[node.type](graph, node, scope)
  // Its visibility can be a component property, as any layer's can.
  return { ...own, props: withPropertyBindings(own.props, node, graph, componentReferences(graph)) }
}

/**
 * The element a layer is written as. An instance whose props cannot be written is written as
 * the frame it draws.
 */
function layerTag(node: SceneNode, instance: JSXProp[] | null): string | undefined {
  return node.type === 'INSTANCE' && !instance ? 'Frame' : elementTag(node.type)
}

/** Whether a text layer's text is a component property, written as a prop rather than as children. */
function hasTextProp(props: JSXProp[]): boolean {
  return props.some(([name]) => name === 'text')
}

/**
 * A layer's props. An instance written as a frame leaves out the swap property it is bound to,
 * which only an instance takes.
 */
function frameProps(
  node: SceneNode,
  graph: SceneGraph,
  variables: VariableExport,
  reference: ComponentReference
): JSXProp[] {
  const props = collectProps(node, graph, variables, reference)
  return node.type === 'INSTANCE' ? props.filter(([name]) => name !== 'of') : props
}

/**
 * What an export writes layers with: connector ends, the refs it declares, variables, and how
 * it names components.
 */
interface ExportScope {
  connectors: ConnectorExportScope
  refs: ReadonlyMap<string, string | null>
  variables: VariableExport
  reference: ComponentReference
}

/** The layers an export writes, by the roots it starts from. */
function nodeToJSX(
  node: SceneNode,
  graph: SceneGraph,
  depth: number,
  scope: ExportScope,
  layerIds?: Array<string | null>,
  outer: RekaExport = NO_REKA
): SyntaxNode[] {
  const { variables, reference } = scope
  const reka = mergeReka(outer, rekaExport(graph, node, reference))
  const ref = scope.refs.get(node.id)
  // A layer a connector or `of` names by a ref is marked with it, after its own props.
  const withRef = (props: JSXProp[]): JSXProp[] =>
    ref ? [...props, ['ref', new Reference(ref)]] : props
  // Hidden children export with `visible={false}` rather than disappearing.
  const children = (childDepth: number) =>
    graph
      .getChildren(node.id)
      .flatMap((child) => nodeToJSX(child, graph, childDepth, scope, layerIds, reka))
  if (reka.flatten.has(node.id)) return children(depth)
  // An icon is written by name; its paths are the icon set's to draw again.
  const icon = iconProps(node, graph)
  if (icon) {
    layerIds?.push(node.id)
    return [jsx.element('Icon', withRef(icon).map(propAttribute), [], depth)]
  }
  const instance =
    node.type === 'INSTANCE' && !reka.tags.has(node.id)
      ? instanceProps(node, graph, variables, reference)
      : null
  const tag = reka.tags.get(node.id) ?? layerTag(node, instance)
  if (!tag) return []
  layerIds?.push(node.id)
  const own = ownElement(graph, node, scope.connectors)
  if (own) {
    const children = own.text ? [jsx.text(own.text)] : []
    return [jsx.element(tag, own.props.map(propAttribute), children, depth, true)]
  }
  const ownProps = reka.props.get(node.id)
  // An item names its component; the instance's own layers are the component's to write.
  if (ownProps?.some(([name]) => name === 'of'))
    return [jsx.element(tag, withRef(ownProps).map(propAttribute), [], depth)]
  // An instance's layers are its component's to draw; what it changes in them is in its props.
  if (instance) return [jsx.element(tag, withRef(instance).map(propAttribute), [], depth)]
  const props = [...frameProps(node, graph, variables, reference), ...(ownProps ?? [])]
  const attributes = withRef(props).map(propAttribute)
  const text =
    node.type === 'TEXT' ? textElement(node, tag, props, attributes, depth, layerIds) : null
  return [text ?? jsx.element(tag, attributes, children(depth + 1), depth)]
}

/**
 * A text layer with its content between its tags. A bound text's characters are the binding's,
 * so it keeps its content only for the styling: null for one with none.
 */
function textElement(
  node: SceneNode,
  tag: string,
  props: JSXProp[],
  attributes: SyntaxNode[],
  depth: number,
  layerIds?: Array<string | null>
): SyntaxNode | null {
  const { children: content, inline } = textChildren(node, depth)
  const count = elementCount(content)
  if (hasTextProp(props) && count === 0) return null
  for (let index = 0; index < count; index++) layerIds?.push(null)
  return jsx.element(tag, attributes, content, depth, inline)
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
 * content, or a connector's label, as a `text` attribute. `null` for a node the export does not
 * write. A connector's ends are written by their layers' names.
 */
export function sceneNodeAttributes(
  nodeId: string,
  graph: SceneGraph
): JSXAttributeSource[] | null {
  const node = graph.getNode(nodeId)
  if (!node) return null
  const reference = componentReferences(graph)
  const variables = variableReferences(graph)
  const instance =
    node.type === 'INSTANCE' ? instanceProps(node, graph, variables, reference) : null
  if (!layerTag(node, instance)) return null
  const own = ownElement(graph, node)
  const props = instance ?? (own ? own.props : frameProps(node, graph, variables, reference))
  if (node.type === 'TEXT' && !hasTextProp(props)) props.push(['text', node.text])
  if (own?.text) props.push(['text', own.text])
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

/** What an element holds between its tags, printed as `sceneNodeToJSX` prints it. */
function contentBetween(tag: string, children: SyntaxNode[], inline: boolean): string | null {
  if (children.length === 0) return null
  const printed = jsx.printJSX(jsx.element(tag, [], children, 0, inline))
  return printed.slice(tag.length + 2, printed.lastIndexOf(`</${tag}>`))
}

export function designJSXElement(nodeId: string, graph: SceneGraph): DesignJSXElement | null {
  const node = graph.getNode(nodeId)
  const printed = sceneNodeAttributes(nodeId, graph)
  if (!node || !printed) return null
  const reference = componentReferences(graph)
  const isInstance =
    node.type === 'INSTANCE' &&
    instanceProps(node, graph, variableReferences(graph), reference) !== null
  const tag = node.type === 'INSTANCE' && !isInstance ? 'Frame' : elementTag(node.type)
  if (!tag) return null
  // A text layer's content, a connector's label, or a sticky note's body is written as its
  // children, not as the `text` attribute; the layers they generate are not written at all.
  // A text layer bound to a component property keeps it as the `text` attribute, and its
  // content only for the styling.
  const own = ownElement(graph, node)
  const boundText =
    node.type === 'TEXT' && hasTextProp(propertyBindingProps(node, graph, reference))
  const content = node.type === 'TEXT' ? textChildren(node, 0) : undefined
  const writesContent = content !== undefined && (!boundText || elementCount(content.children) > 0)
  const attributes = Object.fromEntries(
    printed
      .filter(({ name }) => boundText || !(writesContent || own) || name !== 'text')
      .map(({ name, source }) => [name, source])
  )
  if (content && writesContent) {
    return {
      tag,
      attributes,
      text: contentBetween(tag, content.children, content.inline),
      childIds: []
    }
  }
  if (node.type === 'TEXT' || isInstance) return { tag, attributes, text: null, childIds: [] }
  if (own) {
    const children = own.text ? [jsx.text(own.text)] : []
    return { tag, attributes, text: contentBetween(tag, children, true), childIds: [] }
  }
  const childIds = graph
    .getChildren(node.id)
    .filter((child) => elementTag(child.type))
    .map((child) => child.id)
  return { tag, attributes, text: null, childIds }
}

/** How an export is written: by default, with the declarations its JSX uses before it. */
export interface JSXExportOptions {
  /**
   * `false` writes only JSX, for code that places it inside other JSX: a connector end whose
   * layer would need a declared `ref()` is then written as the point it is drawn at, and the
   * variables layers bind are written by reference (`designVar`) instead of with the
   * `defineVars` and `defineMode` that define them.
   */
  declarations?: boolean
}

export function sceneNodeToJSX(nodeId: string, graph: SceneGraph): string {
  return selectionToJSX([nodeId], graph)
}

export function selectionToJSX(nodeIds: string[], graph: SceneGraph): string {
  return selectionToJSXWithLayers(nodeIds, graph).code
}

export function selectionToJSXWithLayers(
  nodeIds: string[],
  graph: SceneGraph,
  options: JSXExportOptions = {}
): DesignJSXWithLayers {
  const declare = options.declarations ?? true
  const variables = variableExport(graph, nodeIds, declare)
  // Refs are named apart from the variables declared before them.
  const taken = new Set(variables.names)
  const connectors = connectorExportScope(graph, nodeIds, declare, taken)
  const write = (
    refs: ReadonlyMap<string, string | null>,
    onOf?: (component: SceneNode) => void
  ) => {
    const layerIds: Array<string | null> = []
    const reference = componentReferences(graph, refs, onOf)
    const scope = { connectors, refs, variables, reference }
    const roots = compact(
      nodeIds.map((id) => {
        const node = graph.getNode(id)
        const syntax = node ? nodeToJSX(node, graph, 0, scope, layerIds).at(0) : undefined
        return syntax ? jsx.printJSX(syntax) : ''
      })
    )
    return { roots, layerIds, written: new Set(layerIds) }
  }
  // A component written here that an instance names takes a ref, which needs a second pass:
  // the first finds which components those are.
  const named = new Set<string>()
  const first = write(connectors.refs, (component) => named.add(component.id))
  const refs = declare
    ? componentRefs(
        graph,
        [...named].filter((id) => first.written.has(id)),
        connectors.refs,
        taken
      )
    : connectors.refs
  const { roots, layerIds } = refs.size > connectors.refs.size ? write(refs) : first
  const elements = roots.join('\n\n')
  // Variables first: a ref names a layer, and nothing in a variable's definition refers to one.
  const declarations = compact([variables.declarations(), refDeclarations(refs)]).join('\n\n')
  if (!declarations || !elements) return { code: elements, layerIds }
  // Statements end with `return` and the JSX; several roots return as siblings in a fragment.
  const returned = roots.length > 1 ? `<>\n${elements}\n</>` : elements
  return { code: `${declarations}\n\nreturn ${returned}`, layerIds }
}
