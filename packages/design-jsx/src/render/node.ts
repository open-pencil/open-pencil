import { omitBy, range } from 'es-toolkit'

import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import type { RekaScope } from '../behaviours'
import { renderRekaNode } from '../behaviours/render'
import { componentIdNamed, renderInstanceNode } from '../components/instances'
import { bindProperties, inferComponentSetProperties } from '../components/properties'
import { elementNodeType, elementOwnLayer, type OwnLayerRenderer } from '../elements'
import { applySizeOverrides, propsToOverrides, shapeOverrides } from '../overrides'
import { placeVectorPaths } from '../overrides/vector'
import type { LayerRefs } from '../refs'
import { readElementProps } from '../schema'
import type { DesignJSXServices } from '../services'
import { isTextContent, TEXT_CONTENT_NAMES, textContentFields } from '../text-content'
import { isTreeNode } from '../tree'
import type { TreeNode } from '../tree'
import { isVariable } from '../variables'
import { requireVariableId, resolveForLayer, variableModes } from '../variables/graph'
import type { RenderOrder } from './order'
import { applyBindings, layerMetadata, preparePropsForRender } from './props'
import type { RenderOptions } from './types'

/**
 * An element that draws its own layer. Its props are resolved as any layer's are, so a
 * `designVar()` binds, and its layer props become fields as any layer's do; the element reads the
 * rest itself.
 */
function renderOwnLayerElement(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  element: OwnLayerRenderer,
  context: RenderContext | undefined
): SceneNode {
  const modes = variableModes(graph, tree.props.mode)
  const nodeType = elementNodeType(tree.type) ?? 'FRAME'
  const bound = bindProperties(
    graph,
    tree.props,
    nodeType,
    parentId,
    componentIdNamed(graph),
    context?.properties
  )
  const { props, bindings } = preparePropsForRender(graph, bound.props, false, { parentId, modes })
  const parentLayout = graph.getNode(parentId)?.layoutMode ?? 'NONE'
  const layer = omitBy(
    {
      ...propsToOverrides(readElementProps(element.layer, props), false, parentLayout),
      ...layerMetadata(modes, bound.references)
    },
    (value) => value === undefined
  )
  const node = element.render(graph, { ...tree, props }, parentId, layer)
  try {
    for (const [field, variableId] of Object.entries(bindings)) {
      graph.bindVariable(element.bindingTarget?.(graph, node, field) ?? node.id, field, variableId)
    }
  } catch (error) {
    graph.deleteNode(node.id)
    throw error
  }
  return node
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

async function renderArtworkNode<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  context: RenderContext | undefined
): Promise<SceneNode> {
  const bound = bindProperties(
    graph,
    tree.props,
    'VECTOR',
    parentId,
    componentIdNamed(graph),
    context?.properties
  )
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
  parentId: string,
  context?: RenderContext
): ElementOverrides {
  const parentLayout = graph.getNode(parentId)?.layoutMode ?? 'NONE'
  const isText = nodeType === 'TEXT'
  const modes = variableModes(graph, tree.props.mode)
  const bound = bindProperties(
    graph,
    tree.props,
    nodeType,
    parentId,
    componentIdNamed(graph),
    context?.properties
  )
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
  /** What the render skipped, for the author: reported with the results. */
  warnings: string[]
  /** The layers the render created, which a failed render removes. */
  created: string[]
  /** The component properties the render created, which a failed render removes. */
  properties: string[]
}

/**
 * Render `children` under `parentId`: components before the siblings that name them, then in
 * written order. Returns the rendered layers in written order.
 */
async function renderChildren(
  graph: SceneGraph,
  children: TreeNode[],
  parentId: string,
  context: RenderContext | undefined,
  render: (child: TreeNode) => Promise<SceneNode>
): Promise<SceneNode[]> {
  const start = graph.getChildren(parentId).length
  const order = context?.order.of(children) ?? range(children.length)
  const rendered: SceneNode[] = []
  for (const index of order) rendered[index] = await render(children[index])
  if (order.some((index, position) => index !== position))
    rendered.forEach((child, index) => graph.insertChildAt(child.id, parentId, start + index))
  return rendered
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
      return renderArtworkNode(services, graph, tree, parentId, context)
    case 'instance':
      return renderInstanceNode(graph, tree, parentId, context)
    default: {
      const element = elementOwnLayer(tree.type)
      return element
        ? Promise.resolve(renderOwnLayerElement(graph, tree, parentId, element, context))
        : null
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
  if (own) {
    const node = await own
    context?.created.push(node.id)
    return node
  }
  const reka = await renderRekaNode(graph, tree, parentId, scope, {
    renderChildren: (children, childParentId, childScope) =>
      renderChildren(graph, children, childParentId, context, (child) =>
        renderNode(services, graph, child, childParentId, onNode, childScope, context)
      ),
    create: (nodeType, element, elementParentId) => {
      const { overrides, bindings } = elementOverrides(
        graph,
        nodeType,
        element,
        elementParentId,
        context
      )
      const created = graph.createNode(nodeType, elementParentId, overrides)
      context?.created.push(created.id)
      applyBindings(graph, created.id, bindings)
      placeVectorPaths(graph, created, element.props, (network) => services.vectorBounds(network))
      return created
    },
    instance: async (element, elementParentId) => {
      const instance = await renderInstanceNode(graph, element, elementParentId, context)
      context?.created.push(instance.id)
      return instance
    },
    finishSet: (setId) => inferComponentSetProperties(graph, setId)
  })
  if (reka) return reka

  if (isTextContent(tree))
    throw new Error(`<${TEXT_CONTENT_NAMES[tree.type]}> must be inside <Text>`)
  const nodeType = elementNodeType(tree.type)
  if (!nodeType) throw new Error(`Unknown element: <${tree.type}>`)

  const { overrides, bindings } = elementOverrides(graph, nodeType, tree, parentId, context)
  const node = graph.createNode(nodeType, parentId, overrides)
  context?.created.push(node.id)
  applyBindings(graph, node.id, bindings)
  placeVectorPaths(graph, node, tree.props, (network) => services.vectorBounds(network))

  const children = tree.children.filter(
    (child): child is TreeNode =>
      isTreeNode(child) && !(node.type === 'TEXT' && isTextContent(child))
  )
  await renderChildren(graph, children, node.id, context, (child) =>
    renderNode(services, graph, child, node.id, onNode, scope, context)
  )

  if (node.type === 'COMPONENT_SET') inferComponentSetProperties(graph, node.id)

  return node
}
