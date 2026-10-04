import {
  setInstanceOverride,
  type Color,
  type ComponentPropertyDefinition,
  type NodeType,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import {
  assignComponentProperties,
  componentMetadata,
  componentPropertyScope
} from './component-properties'
import { applySizeOverrides, propsToOverrides } from './props-overrides'
import { prepareScalarBindings } from './scalar-bindings'
import type { DesignJSXServices } from './services'
import { FRAGMENT, isTreeNode } from './tree'
import type { TreeNode } from './tree'
import type { RenderOptions } from './types'
import { isVariable, resolveVariableId, type DesignVariable } from './vars'

const TYPE_MAP: Partial<Record<string, NodeType>> = {
  frame: 'FRAME',
  view: 'FRAME',
  rectangle: 'RECTANGLE',
  rect: 'RECTANGLE',
  ellipse: 'ELLIPSE',
  text: 'TEXT',
  line: 'LINE',
  star: 'STAR',
  polygon: 'POLYGON',
  vector: 'VECTOR',
  group: 'GROUP',
  section: 'SECTION',
  component: 'COMPONENT',
  'component-set': 'COMPONENT_SET',
  componentset: 'COMPONENT_SET',
  div: 'FRAME',
  main: 'FRAME',
  header: 'FRAME',
  footer: 'FRAME',
  nav: 'FRAME',
  article: 'FRAME',
  aside: 'FRAME',
  span: 'TEXT',
  p: 'TEXT',
  h1: 'TEXT',
  h2: 'TEXT',
  h3: 'TEXT',
  h4: 'TEXT',
  h5: 'TEXT',
  h6: 'TEXT'
}

export interface RenderResult {
  id: string
  name: string
  type: NodeType
  childIds: string[]
  warnings?: string[]
}

/** Component property ids only need to be unique within a document. */
function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
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

  const nodes: SceneNode[] = []
  for (const root of roots) {
    const node = await renderNode(services, graph, root, parentId, options.onNode)
    if (options.x !== undefined) graph.updateNode(node.id, { x: options.x })
    if (options.y !== undefined) graph.updateNode(node.id, { y: options.y })
    nodes.push(node)
  }

  services.layout(graph)

  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    childIds: node.childIds
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

function variableFallback(graph: SceneGraph, variable: DesignVariable): string | Color | undefined {
  if (variable.value !== undefined && typeof variable.value !== 'number') return variable.value
  const variableId = resolveVariableId(graph, variable)
  return variableId ? graph.resolveColorVariable(variableId) : undefined
}

function bindVariableProp(
  graph: SceneGraph,
  props: Record<string, unknown>,
  bindings: Record<string, string>,
  key: string,
  field: string
): void {
  const value = props[key]
  if (!isVariable(value)) return
  const variableId = resolveVariableId(graph, value)
  if (variableId) bindings[field] = variableId
  const fallback = variableFallback(graph, value)
  if (fallback !== undefined) props[key] = fallback
}

function bindStyleVariableProp(
  graph: SceneGraph,
  style: Record<string, unknown>,
  bindings: Record<string, string>,
  key: string,
  field: string
): void {
  const value = style[key]
  if (!isVariable(value)) return
  const variableId = resolveVariableId(graph, value)
  if (variableId) bindings[field] = variableId
  const fallback = variableFallback(graph, value)
  if (fallback !== undefined) style[key] = fallback
}

function preparePropsForRender(
  graph: SceneGraph,
  source: Record<string, unknown>,
  isText: boolean,
  parentId: string
): PreparedProps {
  const props = { ...source }
  const bindings: Record<string, string> = {}

  if (Array.isArray(props.fills)) {
    props.fills = props.fills.map((value, index) => {
      if (!isVariable(value)) return value
      const variableId = resolveVariableId(graph, value)
      if (variableId) bindings[`fills/${index}/color`] = variableId
      return variableFallback(graph, value) ?? value
    })
  }

  for (const key of ['bg', 'fill', 'background', 'backgroundColor']) {
    bindVariableProp(graph, props, bindings, key, 'fills/0/color')
  }
  if (isText) bindVariableProp(graph, props, bindings, 'color', 'fills/0/color')
  for (const key of ['stroke', 'border', 'borderColor']) {
    bindVariableProp(graph, props, bindings, key, 'strokes/0/color')
  }

  if (isObjectRecord(props.style)) {
    const style = { ...props.style }
    for (const key of ['background', 'backgroundColor']) {
      bindStyleVariableProp(graph, style, bindings, key, 'fills/0/color')
    }
    if (isText) bindStyleVariableProp(graph, style, bindings, 'color', 'fills/0/color')
    bindStyleVariableProp(graph, style, bindings, 'borderColor', 'strokes/0/color')
    props.style = style
  }

  prepareScalarBindings(graph, props, bindings, isText, parentId)

  if (isObjectRecord(props.bind)) {
    for (const [field, value] of Object.entries(props.bind)) {
      if (isVariable(value)) {
        const variableId = resolveVariableId(graph, value)
        if (variableId) bindings[field] = variableId
      } else if (typeof value === 'string') {
        bindings[field] = value
      }
    }
  }

  return { props, bindings }
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
  const color = parseColor((props.color as string | undefined) ?? '#000000')
  return services.createArtwork(graph, artwork, { parentId, size, color, overrides })
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

function parseVariantValues(name: string): Record<string, string> {
  const entries = name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const values: Record<string, string> = {}
  for (const entry of entries) {
    const [key = '', ...rest] = entry.split('=')
    const property = key.trim()
    const value = rest.join('=').trim()
    if (property && value) values[property] = value
  }
  return values
}

function inferComponentSetProperties(graph: SceneGraph, componentSetId: string): void {
  const componentSet = graph.getNode(componentSetId)
  if (componentSet?.type !== 'COMPONENT_SET') return
  const existingDefinitions = componentSet.componentPropertyDefinitions

  const variants = graph.getChildren(componentSetId).filter((node) => node.type === 'COMPONENT')
  const options = new Map<string, Set<string>>()
  const valuesById = new Map<string, Record<string, string>>()

  for (const variant of variants) {
    const values = parseVariantValues(variant.name)
    valuesById.set(variant.id, values)
    for (const [property, value] of Object.entries(values)) {
      let set = options.get(property)
      if (!set) {
        set = new Set()
        options.set(property, set)
      }
      set.add(value)
    }
  }

  const definitions: ComponentPropertyDefinition[] = [...options.entries()]
    .filter(
      ([name]) =>
        !existingDefinitions.some(
          (definition) => definition.type === 'VARIANT' && definition.name === name
        )
    )
    .map(([name, values]) => {
      const variantOptions = [...values]
      return {
        id: `prop:${randomHex(8)}`,
        name,
        type: 'VARIANT',
        defaultValue: variantOptions[0] ?? '',
        variantOptions
      }
    })

  for (const [id, values] of valuesById) {
    graph.updateNode(id, { componentPropertyValues: values })
  }
  graph.updateNode(componentSetId, {
    componentPropertyDefinitions: [...existingDefinitions, ...definitions]
  })
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

function resolveComponent(
  graph: SceneGraph,
  props: Record<string, unknown>
): SceneNode | undefined {
  const ref = props.component ?? props.componentId ?? props.of
  if (typeof ref !== 'string') return undefined

  const byId = graph.getNode(ref)
  if (byId?.type === 'COMPONENT') return byId
  if (byId?.type === 'COMPONENT_SET') return findVariantInSet(graph, byId, props)

  const byName = findComponentByName(graph, ref)
  if (byName) return byName

  for (const node of graph.getAllNodes()) {
    if (node.type === 'COMPONENT_SET' && node.name === ref)
      return findVariantInSet(graph, node, props)
  }
  return undefined
}

async function renderInstanceNode(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string
): Promise<SceneNode> {
  const parent = graph.getNode(parentId)
  const parentLayout = parent?.layoutMode ?? 'NONE'
  const { props, bindings } = preparePropsForRender(graph, tree.props, false, parentId)
  const component = resolveComponent(graph, props)
  if (!component) {
    const ref = props.component ?? props.componentId ?? props.of
    const label = typeof ref === 'string' || typeof ref === 'number' ? String(ref) : ''
    throw new Error(`<Instance> component not found: ${label}`)
  }
  const overrides: Partial<SceneNode> = {
    ...propsToOverrides(props, false, parentLayout),
    ...componentMetadata(props, 'INSTANCE', componentPropertyScope(graph, parentId))
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
    assignComponentProperties(graph, instance, props.properties)
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
  const metadata = componentMetadata(tree.props, 'VECTOR', componentPropertyScope(graph, parentId))
  const node =
    tree.type === 'icon'
      ? await renderIconNode(services, graph, tree, parentId)
      : renderSVGNode(services, graph, tree, parentId)
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
  parentId: string
): ElementOverrides {
  const parentLayout = graph.getNode(parentId)?.layoutMode ?? 'NONE'
  const isText = nodeType === 'TEXT'
  const { props, bindings } = preparePropsForRender(graph, tree.props, isText, parentId)
  const overrides = {
    ...propsToOverrides(props, isText, parentLayout),
    ...componentMetadata(props, nodeType, componentPropertyScope(graph, parentId))
  }

  if (isText) {
    const childText = tree.children.filter((c): c is string => typeof c === 'string').join('')
    const propText =
      props.text ?? props.characters ?? props.content ?? props.label ?? props.value ?? props.title
    if (childText) overrides.text = childText
    else if (typeof propText === 'string') overrides.text = propText
  }
  return { overrides, bindings }
}

async function renderNode<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  onNode?: RenderOptions['onNode']
): Promise<SceneNode> {
  const node = await renderNodeContent(services, graph, tree, parentId, onNode)
  onNode?.(tree, node)
  return node
}

async function renderNodeContent<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  onNode?: RenderOptions['onNode']
): Promise<SceneNode> {
  if (tree.type === 'icon' || tree.type === 'svg')
    return renderArtworkNode(services, graph, tree, parentId)
  if (tree.type === 'instance') return renderInstanceNode(graph, tree, parentId)

  const nodeType = TYPE_MAP[tree.type]
  if (!nodeType) throw new Error(`Unknown element: <${tree.type}>`)

  const { overrides, bindings } = elementOverrides(graph, nodeType, tree, parentId)
  const node = graph.createNode(nodeType, parentId, overrides)
  applyBindings(graph, node.id, bindings)

  for (const child of tree.children) {
    if (typeof child === 'string') continue
    if (isTreeNode(child)) {
      await renderNode(services, graph, child, node.id, onNode)
    }
  }

  if (node.type === 'COMPONENT_SET') inferComponentSetProperties(graph, node.id)

  return node
}
