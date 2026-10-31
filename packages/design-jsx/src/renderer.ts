import { omitBy } from 'es-toolkit/object'

import type { NodeType, SceneGraph, SceneNode, VariableModeMap } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { INSTANCE_OVERRIDE_FIELDS } from '@open-pencil/scene-graph/instances'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

import type { RekaScope } from './behaviours'
import { renderRekaNode } from './behaviours/render'
import {
  assignComponentProperties,
  assignNamedProperties,
  bindProperties,
  componentPropNames as namesOnInstance,
  exposeInstance,
  inferComponentSetProperties,
  type ComponentLookup
} from './component-properties'
import { elementNodeType, elementOwnLayer, type OwnLayerRenderer } from './elements'
import type { RenderOrder } from './order'
import { placeVectorPaths } from './overrides/vector'
import { applySizeOverrides, propsToOverrides, shapeOverrides } from './props-overrides'
import { isLayerRef, type LayerRefs } from './refs'
import { prepareScalarBindings } from './scalar-bindings'
import { readElementProps } from './schema'
import type { DesignJSXServices } from './services'
import { isTextContent, TEXT_CONTENT_NAMES, textContentFields } from './text-content'
import { isTreeNode } from './tree'
import type { TreeNode } from './tree'
import type { RenderOptions } from './types'
import { isVariable } from './variables'
import {
  bindVariableProp,
  requireVariableId,
  resolveForLayer,
  variableModes,
  type LayerContext
} from './variables/graph'
import { paintProps } from './variables/props'

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
function namedComponent(
  graph: SceneGraph,
  props: Record<string, unknown>,
  refs?: LayerRefs
): SceneNode | undefined {
  const ref = props.component ?? props.componentId ?? props.of
  if (isLayerRef(ref)) {
    const marked = graph.getNode(refs?.layerOf(ref) ?? '')
    return marked?.type === 'COMPONENT' || marked?.type === 'COMPONENT_SET' ? marked : undefined
  }
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
  props: Record<string, unknown>,
  refs?: LayerRefs
): SceneNode | undefined {
  const named = namedComponent(graph, props, refs)
  return named?.type === 'COMPONENT_SET' ? findVariantInSet(graph, named, props) : named
}

/**
 * The names an element sets on its component by prop: properties such as `State` or `Title`, and
 * exposed instances. The instance it rendered as, if given, names its component.
 */
export function componentPropNames(
  graph: SceneGraph,
  props: Record<string, unknown>,
  rendered?: SceneNode
): string[] {
  const component =
    rendered?.type === 'INSTANCE'
      ? graph.getNode(rendered.componentId ?? '')
      : resolveComponent(graph, props)
  return component ? namesOnInstance(graph, component) : []
}

/** The error for an `<Instance>` whose component no name, ID, or ref finds. */
function componentNotFound(props: Record<string, unknown>): Error {
  const ref = props.component ?? props.componentId ?? props.of
  if (isLayerRef(ref)) return new Error('<Instance> ref() marks no component rendered before it')
  const label = typeof ref === 'string' || typeof ref === 'number' ? String(ref) : ''
  return new Error(`<Instance> component not found: ${label}`)
}

async function renderInstanceNode(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  context?: RenderContext
): Promise<SceneNode> {
  const parent = graph.getNode(parentId)
  const parentLayout = parent?.layoutMode ?? 'NONE'
  const modes = variableModes(graph, tree.props.mode)
  const lookup = componentIdNamed(graph, context?.refs)
  const bound = bindProperties(graph, tree.props, 'INSTANCE', parentId, lookup)
  const { props, bindings } = preparePropsForRender(graph, bound.props, false, { parentId, modes })
  const component = resolveComponent(graph, props, context?.refs)
  if (!component) throw componentNotFound(props)
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
    assignNamedProperties(graph, instance, props, lookup)
    assignComponentProperties(graph, instance, props.properties, lookup)
    if (props.exposed === true) exposeInstance(graph, instance)
    return instance
  } catch (error) {
    graph.deleteNode(instance.id)
    throw error
  }
}

/**
 * The fields an instance may override in its layers, as Figma allows; where a layer sits, its
 * shape, its place in the tree, and its component follow the component.
 */
const OVERRIDE_FIELDS = new Set<string>(INSTANCE_OVERRIDE_FIELDS)

/**
 * Apply child overrides to a freshly created instance. Keys are
 * `childName:prop` (e.g. 'label:text', 'icon:fills'); the child is resolved by
 * name among the instance's descendants, before any override renames one, and the
 * value is applied to both the child node and the instance's overrides record so
 * component sync keeps it. A name several descendants share is an error.
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
  for (const cid of instance.childIds) walk(cid)

  // A layer's name may hold a colon; a field's never does.
  const targets = entries.flatMap(([key, value]) => {
    const sep = key.lastIndexOf(':')
    if (sep === -1) return []
    const childName = key.slice(0, sep)
    const prop = key.slice(sep + 1)
    if (!OVERRIDE_FIELDS.has(prop)) return []
    const matches = descendants.filter((n) => n.name === childName)
    if (matches.length > 1)
      throw new Error(
        `overrides key ${key} is ambiguous: ${matches.length} layers are named ${childName}`
      )
    const child = matches.at(0)
    return child ? [{ child, prop, value }] : []
  })
  for (const { child, prop, value } of targets) {
    graph.updateNode(child.id, { [prop]: value })
    setInstanceOverride(instance.instanceOverrides, instance.id, child.id, prop, value)
  }
  if (targets.length > 0) {
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
function componentIdNamed(graph: SceneGraph, refs?: LayerRefs): ComponentLookup {
  return (reference) => resolveComponent(graph, { of: reference }, refs)?.id
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

/** What one render call shares across its elements: the layers refs marked, and their order. */
export interface RenderContext {
  refs: LayerRefs
  order: RenderOrder
}

export async function renderNode<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  onNode?: RenderOptions['onNode'],
  scope?: RekaScope,
  context?: RenderContext
): Promise<SceneNode> {
  const node = await renderNodeContent(services, graph, tree, parentId, onNode, scope, context)
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
  parentId: string,
  context?: RenderContext
): Promise<SceneNode> | null {
  switch (tree.type) {
    case 'icon':
    case 'svg':
      return renderArtworkNode(services, graph, tree, parentId)
    case 'instance':
      return renderInstanceNode(graph, tree, parentId, context)
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
  scope?: RekaScope,
  context?: RenderContext
): Promise<SceneNode> {
  const own = renderOwnElement(services, graph, tree, parentId, context)
  if (own) return own
  const reka = await renderRekaNode(graph, tree, parentId, scope, {
    render: (child, childParentId, childScope) =>
      renderNode(services, graph, child, childParentId, onNode, childScope, context),
    create: (nodeType, element, elementParentId) => {
      const { overrides, bindings } = elementOverrides(graph, nodeType, element, elementParentId)
      const created = graph.createNode(nodeType, elementParentId, overrides)
      applyBindings(graph, created.id, bindings)
      placeVectorPaths(graph, created, element.props, (network) => services.vectorBounds(network))
      return created
    },
    instance: (element, elementParentId) =>
      renderInstanceNode(graph, element, elementParentId, context),
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

  const children = tree.children.filter(
    (child): child is TreeNode =>
      isTreeNode(child) && !(node.type === 'TEXT' && isTextContent(child))
  )
  // Components render before the siblings that use them, then the children take written order.
  const order = context?.order.of(children) ?? children.map((_, index) => index)
  const rendered: SceneNode[] = []
  for (const index of order) {
    rendered[index] = await renderNode(
      services,
      graph,
      children[index],
      node.id,
      onNode,
      scope,
      context
    )
  }
  if (order.some((index, position) => index !== position))
    rendered.forEach((child, index) => graph.insertChildAt(child.id, node.id, index))

  if (node.type === 'COMPONENT_SET') inferComponentSetProperties(graph, node.id)

  return node
}
