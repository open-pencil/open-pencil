import { omitBy } from 'es-toolkit/object'

import type { NodeType, SceneGraph, SceneNode, VariableModeMap } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

import type { RekaScope } from './behaviours'
import { renderRekaNode } from './behaviours/render'
import {
  assignComponentProperties,
  assignNamedProperties,
  bindProperties,
  componentPropNames as namesOnInstance,
  exposeInstance,
  inferComponentSetProperties
} from './component-properties'
import { CONNECTOR_ELEMENT, resolveConnectorEnds } from './connectors'
import { elementNodeType, elementOwnLayer, type OwnLayerRenderer } from './elements'
import { placeVectorPaths } from './overrides/vector'
import { applySizeOverrides, propsToOverrides, shapeOverrides } from './props-overrides'
import { LayerRefs } from './refs'
import { prepareScalarBindings } from './scalar-bindings'
import { readElementProps } from './schema'
import type { DesignJSXServices } from './services'
import { isTextContent, TEXT_CONTENT_NAMES, textContentFields } from './text-content'
import { FRAGMENT, isTreeNode } from './tree'
import type { TreeNode } from './tree'
import type { RenderOptions } from './types'
import { isVariable } from './variables'
import {
  applyVariableDefinitions,
  bindVariableProp,
  requireVariableId,
  resolveForLayer,
  variableModes,
  type LayerContext
} from './variables/graph'
import { paintProps } from './variables/props'

export interface RenderResult {
  id: string
  name: string
  type: NodeType
  childIds: string[]
  warnings?: string[]
}

/** The nodes a tree renders as: a fragment's children, or the tree itself. */
function treeRoots(tree: TreeNode): TreeNode[] {
  return tree.type === FRAGMENT ? tree.children.filter(isTreeNode) : [tree]
}

/** Render every root of `tree` into the parent and lay out once. */
export async function renderRoots<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  options: RenderOptions = {}
): Promise<RenderResult[]> {
  const roots = treeRoots(tree)
  if (roots.length === 0) throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  const parentId = options.parentId ?? graph.getPages()[0].id
  applyVariableDefinitions(graph, tree)

  const nodes: SceneNode[] = []
  const connectors: Array<{ node: SceneNode; tree: TreeNode }> = []
  const refs = new LayerRefs()
  const onNode = (element: TreeNode, node: SceneNode) => {
    if (element.type === CONNECTOR_ELEMENT) connectors.push({ node, tree: element })
    else refs.mark(element.props.ref, node)
    options.onNode?.(element, node)
  }
  for (const root of roots) {
    const node = await renderNode(services, graph, root, parentId, onNode)
    if (options.x !== undefined) graph.updateNode(node.id, { x: options.x })
    if (options.y !== undefined) graph.updateNode(node.id, { y: options.y })
    nodes.push(node)
  }

  const rootIds = nodes.map((node) => node.id)
  const warnings = [...refs.warnings, ...resolveConnectorEnds(graph, rootIds, connectors, refs)]
  if (!options.deferLayout) services.layout(graph, rootIds)

  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    childIds: node.childIds,
    ...(warnings.length > 0 && { warnings })
  }))
}

/** Render `tree` and return its first root; a fragment's other roots are rendered too. */
export async function renderTree<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const [first] = await renderRoots(services, graph, tree, options)
  return first
}

interface PreparedProps {
  props: Record<string, unknown>
  bindings: Record<string, string>
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function preparePropsForRender(
  graph: SceneGraph,
  source: Record<string, unknown>,
  isText: boolean,
  layer: LayerContext
): PreparedProps {
  const props = { ...source }
  const bindings: Record<string, string> = {}

  if (Array.isArray(props.fills)) {
    props.fills = props.fills.map((value: unknown, index) => {
      const fill = { value }
      bindVariableProp(graph, fill, bindings, 'value', `fills/${index}/color`, layer)
      return fill.value
    })
  }

  for (const { prop, fields } of paintProps({ text: isText })) {
    bindVariableProp(graph, props, bindings, prop, fields[0], layer)
  }

  if (isObjectRecord(props.style)) {
    const style = { ...props.style }
    for (const key of ['background', 'backgroundColor']) {
      bindVariableProp(graph, style, bindings, key, 'fills/0/color', layer)
    }
    if (isText) bindVariableProp(graph, style, bindings, 'color', 'fills/0/color', layer)
    bindVariableProp(graph, style, bindings, 'borderColor', 'strokes/0/color', layer)
    props.style = style
  }

  prepareScalarBindings(graph, props, bindings, isText, (variableId) =>
    resolveForLayer(graph, variableId, layer.parentId, layer.modes)
  )

  if (isObjectRecord(props.bind)) {
    for (const [field, value] of Object.entries(props.bind)) {
      if (isVariable(value)) {
        bindings[field] = requireVariableId(graph, value)
      } else if (typeof value === 'string') {
        bindings[field] = value
      }
    }
  }

  return { props, bindings }
}

/**
 * An element that draws its own layer. Its props are resolved as any layer's are, so a
 * `designVar()` binds, and its layer props become fields as any layer's do; the element reads the
 * rest itself.
 */
function renderOwnLayerElement(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  element: OwnLayerRenderer
): SceneNode {
  const modes = variableModes(graph, tree.props.mode)
  const { props, bindings } = preparePropsForRender(graph, tree.props, false, { parentId, modes })
  const parentLayout = graph.getNode(parentId)?.layoutMode ?? 'NONE'
  const layer = omitBy(
    {
      ...propsToOverrides(readElementProps(element.layer, props), false, parentLayout),
      ...(modes && { variableModes: modes })
    },
    (value) => value === undefined
  )
  const node = element.render(graph, { ...tree, props }, parentId, layer)
  for (const [field, variableId] of Object.entries(bindings)) {
    graph.bindVariable(element.bindingTarget?.(graph, node, field) ?? node.id, field, variableId)
  }
  return node
}

function applyBindings(graph: SceneGraph, nodeId: string, bindings: Record<string, string>): void {
  for (const [field, variableId] of Object.entries(bindings)) {
    graph.bindVariable(nodeId, field, variableId)
  }
}

function applyIconSize(
  props: Record<string, unknown>,
  overrides: Partial<SceneNode>,
  parentLayout: SceneNode['layoutMode'],
  size: number
): void {
  const { w, h } = applySizeOverrides(props, overrides, parentLayout)
  if (typeof w !== 'number') overrides.width = size
  if (typeof h !== 'number') overrides.height = size
}

async function renderIconNode<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string
): Promise<SceneNode> {
  const props = tree.props
  const iconName = props.name as string | undefined
  if (!iconName) throw new Error('<Icon> requires a name prop (e.g. name="lucide:heart")')

  const size = (props.size as number | undefined) ?? 24
  const artwork = await services.icon(iconName, size)
  if (!artwork) throw new Error(`Icon "${iconName}" not found`)
  return placeArtwork(services, graph, artwork, props, size, parentId)
}

function placeArtwork<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  artwork: Artwork,
  props: Record<string, unknown>,
  size: number,
  parentId: string
): SceneNode {
  const parentLayout = graph.getNode(parentId)?.layoutMode ?? 'NONE'
  const overrides: Partial<SceneNode> = {}
  if (props.label) overrides.name = props.label as string
  applyIconSize(props, overrides, parentLayout, size)
  const modes = variableModes(graph, props.mode)
  if (modes) overrides.variableModes = modes
  const variableId = isVariable(props.color) ? requireVariableId(graph, props.color) : undefined
  const resolved = variableId && resolveForLayer(graph, variableId, parentId, modes)
  if (isVariable(props.color) && typeof resolved !== 'object')
    throw new Error(`Cannot resolve color variable ${props.color.name} for color`)
  const color =
    typeof resolved === 'object'
      ? resolved
      : parseColor(typeof props.color === 'string' ? props.color : '#000000')
  const node = services.createArtwork(graph, artwork, { parentId, size, color, overrides })
  if (variableId) bindSolidPaints(graph, node, variableId)
  return node
}

/** Bind every solid paint of an artwork's paths, so it follows the variable it was drawn in. */
function bindSolidPaints(graph: SceneGraph, node: SceneNode, variableId: string): void {
  for (const field of ['fills', 'strokes'] as const) {
    node[field].forEach((paint, index) => {
      if (paint.type === 'SOLID') graph.bindVariable(node.id, `${field}/${index}/color`, variableId)
    })
  }
  for (const child of graph.getChildren(node.id)) bindSolidPaints(graph, child, variableId)
}

/**
 * Render an inline <svg> element into vector nodes through the same artwork path as
 * icons. The body may be string children or a `body` prop; parsed shape children work too.
 */
function renderSVGNode<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string
): SceneNode {
  const props = tree.props
  const explicitW = typeof props.w === 'number' ? props.w : 0
  const explicitH = typeof props.h === 'number' ? props.h : 0
  const size =
    explicitW > 0 || explicitH > 0
      ? Math.max(explicitW, explicitH)
      : ((props.size as number | undefined) ?? 24)
  const body =
    (typeof props.body === 'string' && props.body) ||
    tree.children.filter((c): c is string => typeof c === 'string').join('')
  const artwork = services.svg({ body, elements: tree.children.filter(isTreeNode), props }, size)
  if (!artwork) {
    throw new Error('<svg> requires SVG markup, a body prop, or supported SVG shape children')
  }
  return placeArtwork(services, graph, artwork, props, size, parentId)
}

function findComponentByName(graph: SceneGraph, name: string): SceneNode | undefined {
  for (const node of graph.getAllNodes()) {
    if (node.type === 'COMPONENT' && node.name === name) return node
  }
  return undefined
}

function findVariantInSet(
  graph: SceneGraph,
  componentSet: SceneNode,
  props: Record<string, unknown>
) {
  const requested = Object.fromEntries(
    Object.entries(props)
      .filter(([key]) =>
        componentSet.componentPropertyDefinitions.some(
          (definition) => definition.type === 'VARIANT' && definition.name === key
        )
      )
      .map(([key, value]) => [key, String(value)])
  )
  const variants = graph.getChildren(componentSet.id).filter((node) => node.type === 'COMPONENT')
  return (
    variants.find((variant) =>
      Object.entries(requested).every(
        ([key, value]) => variant.componentPropertyValues[key] === value
      )
    ) ?? variants[0]
  )
}

/** The component or component set an element names by id or name. */
function namedComponent(graph: SceneGraph, props: Record<string, unknown>): SceneNode | undefined {
  const ref = props.component ?? props.componentId ?? props.of
  if (typeof ref !== 'string') return undefined

  const byId = graph.getNode(ref)
  if (byId?.type === 'COMPONENT' || byId?.type === 'COMPONENT_SET') return byId

  const byName = findComponentByName(graph, ref)
  if (byName) return byName

  for (const node of graph.getAllNodes()) {
    if (node.type === 'COMPONENT_SET' && node.name === ref) return node
  }
  return undefined
}

function resolveComponent(
  graph: SceneGraph,
  props: Record<string, unknown>
): SceneNode | undefined {
  const named = namedComponent(graph, props)
  return named?.type === 'COMPONENT_SET' ? findVariantInSet(graph, named, props) : named
}

/**
 * The names an element sets on its component by prop: properties such as `State` or `Title`, and
 * exposed instances.
 */
export function componentPropNames(graph: SceneGraph, props: Record<string, unknown>): string[] {
  const component = resolveComponent(graph, props)
  return component ? namesOnInstance(graph, component) : []
}

async function renderInstanceNode(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string
): Promise<SceneNode> {
  const parent = graph.getNode(parentId)
  const parentLayout = parent?.layoutMode ?? 'NONE'
  const modes = variableModes(graph, tree.props.mode)
  const bound = bindProperties(graph, tree.props, 'INSTANCE', parentId, componentIdNamed(graph))
  const { props, bindings } = preparePropsForRender(graph, bound.props, false, { parentId, modes })
  const component = resolveComponent(graph, props)
  if (!component) {
    const ref = props.component ?? props.componentId ?? props.of
    const label = typeof ref === 'string' || typeof ref === 'number' ? String(ref) : ''
    throw new Error(`<Instance> component not found: ${label}`)
  }
  const overrides: Partial<SceneNode> = {
    ...propsToOverrides(props, false, parentLayout),
    ...layerMetadata(modes, bound.references)
  }
  // Instances inherit their container layout, but explicitly authored dimensions
  // must also replace the inherited sizing mode on that axis.
  const layout = overrides.layoutMode ?? component.layoutMode
  if (layout !== 'NONE') {
    const axes =
      layout === 'HORIZONTAL'
        ? (['primaryAxisSizing', 'counterAxisSizing'] as const)
        : (['counterAxisSizing', 'primaryAxisSizing'] as const)
    for (const [dimension, field] of [
      ['w', axes[0]],
      ['h', axes[1]]
    ] as const) {
      const value = props[dimension]
      if (typeof value === 'number') overrides[field] = 'FIXED'
      else if (value === 'hug' || value === 'fill') overrides[field] = 'HUG'
    }
  }
  const instance =
    graph.createInstance(component.id, parentId, overrides) ?? graph.createNode('FRAME', parentId)
  try {
    for (const [field, value] of Object.entries(overrides)) {
      setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, field, value)
    }
    graph.updateNode(instance.id, { instanceOverrides: instance.instanceOverrides })
    applyBindings(graph, instance.id, bindings)
    applyInstanceOverrides(graph, instance, tree.props.overrides)
    assignNamedProperties(graph, instance, props, componentIdNamed(graph))
    assignComponentProperties(graph, instance, props.properties, componentIdNamed(graph))
    if (props.exposed === true) exposeInstance(graph, instance)
    return instance
  } catch (error) {
    graph.deleteNode(instance.id)
    throw error
  }
}

/**
 * Apply child overrides to a freshly created instance. Keys are
 * `childName:prop` (e.g. 'label:text', 'icon:fills'); the child is resolved by
 * name among the instance's descendants, and the value is applied to both the
 * child node and the instance's overrides record so component sync keeps it.
 */
function applyInstanceOverrides(
  graph: SceneGraph,
  instance: SceneNode,
  overridesProp: unknown
): void {
  if (!overridesProp || typeof overridesProp !== 'object') return
  if (Array.isArray(overridesProp)) return
  const entries = Object.entries(overridesProp)
  if (entries.length === 0) return

  const descendants: SceneNode[] = []
  const walk = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    descendants.push(node)
    for (const cid of node.childIds) walk(cid)
  }
  walk(instance.id)

  let mutated = false
  for (const [key, value] of entries) {
    const sep = key.indexOf(':')
    if (sep === -1) continue
    const childName = key.slice(0, sep)
    const prop = key.slice(sep + 1)
    const child = descendants.find((n) => n.name === childName)
    if (!child || !(prop in child)) continue
    graph.updateNode(child.id, { [prop]: value } as Partial<SceneNode>)
    setInstanceOverride(instance.instanceOverrides, instance.id, child.id, prop, value)
    mutated = true
  }
  if (mutated) {
    graph.updateNode(instance.id, { instanceOverrides: instance.instanceOverrides })
  }
}

async function renderArtworkNode<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string
): Promise<SceneNode> {
  const bound = bindProperties(graph, tree.props, 'VECTOR', parentId, componentIdNamed(graph))
  const artwork = { ...tree, props: bound.props }
  const node =
    tree.type === 'icon'
      ? await renderIconNode(services, graph, artwork, parentId)
      : renderSVGNode(services, graph, artwork, parentId)
  const metadata: Partial<SceneNode> = layerMetadata(undefined, bound.references)
  if (typeof bound.props.visible === 'boolean') metadata.visible = bound.props.visible
  if (Object.keys(metadata).length > 0) graph.updateNode(node.id, metadata)
  return node
}

/** The modes a layer pins and the component properties its fields are bound to. */
function layerMetadata(
  modes: VariableModeMap | undefined,
  references: SceneNode['componentPropertyReferences']
): Partial<SceneNode> {
  return {
    ...(modes && { variableModes: modes }),
    ...(references.length > 0 && { componentPropertyReferences: references })
  }
}

/** The component a swap property's default names, by ID or name, as `<Instance of>` finds it. */
function componentIdNamed(graph: SceneGraph) {
  return (name: string) => resolveComponent(graph, { of: name })?.id
}

export interface ElementOverrides {
  overrides: Partial<SceneNode>
  /** Variable IDs by bound field, such as `fills/0/color`. */
  bindings: Record<string, string>
}

/** The fields and variable bindings an element's props set on a `nodeType` node under `parentId`. */
export function elementOverrides(
  graph: SceneGraph,
  nodeType: NodeType,
  tree: TreeNode,
  parentId: string
): ElementOverrides {
  const parentLayout = graph.getNode(parentId)?.layoutMode ?? 'NONE'
  const isText = nodeType === 'TEXT'
  const modes = variableModes(graph, tree.props.mode)
  const bound = bindProperties(graph, tree.props, nodeType, parentId, componentIdNamed(graph))
  const layer = { parentId, modes }
  const { props, bindings } = preparePropsForRender(graph, bound.props, isText, layer)
  const overrides = {
    ...propsToOverrides(props, isText, parentLayout),
    ...shapeOverrides(nodeType, props),
    ...layerMetadata(modes, bound.references)
  }

  if (isText) {
    // A span's variables give their values; characters keep no bindings of their own.
    const spanOverrides = (spanProps: Record<string, unknown>) =>
      propsToOverrides(preparePropsForRender(graph, spanProps, true, layer).props, true, 'NONE')
    Object.assign(overrides, textContentFields(tree, props, overrides, spanOverrides))
  }
  return { overrides, bindings }
}

async function renderNode<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  onNode?: RenderOptions['onNode'],
  scope?: RekaScope
): Promise<SceneNode> {
  const node = await renderNodeContent(services, graph, tree, parentId, onNode, scope)
  onNode?.(tree, node)
  return node
}

/**
 * The elements rendered their own way rather than as the layer their definition names, or null
 * for any other element.
 */
function renderOwnElement<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string
): Promise<SceneNode> | null {
  switch (tree.type) {
    case 'icon':
    case 'svg':
      return renderArtworkNode(services, graph, tree, parentId)
    case 'instance':
      return renderInstanceNode(graph, tree, parentId)
    default: {
      const element = elementOwnLayer(tree.type)
      return element ? Promise.resolve(renderOwnLayerElement(graph, tree, parentId, element)) : null
    }
  }
}

async function renderNodeContent<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  onNode?: RenderOptions['onNode'],
  scope?: RekaScope
): Promise<SceneNode> {
  const own = renderOwnElement(services, graph, tree, parentId)
  if (own) return own
  const reka = await renderRekaNode(graph, tree, parentId, scope, {
    render: (child, childParentId, childScope) =>
      renderNode(services, graph, child, childParentId, onNode, childScope),
    create: (nodeType, element, elementParentId) => {
      const { overrides, bindings } = elementOverrides(graph, nodeType, element, elementParentId)
      const created = graph.createNode(nodeType, elementParentId, overrides)
      applyBindings(graph, created.id, bindings)
      placeVectorPaths(graph, created, element.props, (network) => services.vectorBounds(network))
      return created
    },
    instance: (element, elementParentId) => renderInstanceNode(graph, element, elementParentId),
    finishSet: (setId) => inferComponentSetProperties(graph, setId)
  })
  if (reka) return reka

  if (isTextContent(tree))
    throw new Error(`<${TEXT_CONTENT_NAMES[tree.type]}> must be inside <Text>`)
  const nodeType = elementNodeType(tree.type)
  if (!nodeType) throw new Error(`Unknown element: <${tree.type}>`)

  const { overrides, bindings } = elementOverrides(graph, nodeType, tree, parentId)
  const node = graph.createNode(nodeType, parentId, overrides)
  applyBindings(graph, node.id, bindings)
  placeVectorPaths(graph, node, tree.props, (network) => services.vectorBounds(network))

  for (const child of tree.children) {
    if (typeof child === 'string' || (node.type === 'TEXT' && isTextContent(child))) continue
    if (isTreeNode(child)) {
      await renderNode(services, graph, child, node.id, onNode, scope)
    }
  }

  if (node.type === 'COMPONENT_SET') inferComponentSetProperties(graph, node.id)

  return node
}
