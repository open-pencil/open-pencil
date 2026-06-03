import { parseColor } from '#core/color'
import type { RenderOptions } from '#core/design-jsx/types'
import { fetchIcons } from '#core/icons'
import { createIconFromPaths } from '#core/icons/render'
import { computeAllLayouts } from '#core/layout'
import { randomHex } from '#core/random'
import type {
  ComponentPropertyDefinition,
  SceneGraph,
  SceneNode,
  NodeType
} from '#core/scene-graph'

import { applySizeOverrides, propsToOverrides } from './props-overrides'
import { isTreeNode } from './tree'
import type { TreeNode } from './tree'

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

export async function renderTree(
  graph: SceneGraph,
  tree: TreeNode,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const parentId = options.parentId ?? graph.getPages()[0].id

  const result = await renderNode(graph, tree, parentId)

  if (options.x !== undefined) graph.updateNode(result.id, { x: options.x })
  if (options.y !== undefined) graph.updateNode(result.id, { y: options.y })

  computeAllLayouts(graph)

  return {
    id: result.id,
    name: result.name,
    type: result.type,
    childIds: result.childIds
  }
}

async function renderIconNode(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string
): Promise<SceneNode> {
  const props = tree.props
  const iconName = props.name as string | undefined
  if (!iconName) throw new Error('<Icon> requires a name prop (e.g. name="lucide:heart")')

  const size = (props.size as number | undefined) ?? 24
  const colorHex = (props.color as string | undefined) ?? '#000000'
  const parsedColor = parseColor(colorHex)

  const icons = await fetchIcons([iconName], size)
  const icon = icons.get(iconName)
  if (!icon || icon.paths.length === 0) {
    throw new Error(`Icon "${iconName}" not found`)
  }

  const parent = graph.getNode(parentId)
  const parentLayout = parent?.layoutMode ?? 'NONE'
  const overrides: Partial<SceneNode> = {}
  if (props.label) overrides.name = props.label as string
  const { w, h } = applySizeOverrides(props, overrides, parentLayout)
  if (typeof w !== 'number') overrides.width = size
  if (typeof h !== 'number') overrides.height = size

  return createIconFromPaths(graph, icon, iconName, size, parsedColor, parentId, overrides)
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
  if (componentSet.componentPropertyDefinitions.length > 0) return

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

  const definitions: ComponentPropertyDefinition[] = [...options.entries()].map(
    ([name, values]) => {
      const variantOptions = [...values]
      return {
        id: `prop:${randomHex(8)}`,
        name,
        type: 'VARIANT',
        defaultValue: variantOptions[0] ?? '',
        variantOptions
      }
    }
  )
  if (definitions.length === 0) return

  for (const [id, values] of valuesById) {
    graph.updateNode(id, { componentPropertyValues: values })
  }
  graph.updateNode(componentSetId, { componentPropertyDefinitions: definitions })
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
      .filter(([key]) => !['component', 'componentId', 'of', 'name', 'children'].includes(key))
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
  const component = resolveComponent(graph, tree.props)
  if (!component) {
    const ref = tree.props.component ?? tree.props.componentId ?? tree.props.of
    const label = typeof ref === 'string' || typeof ref === 'number' ? String(ref) : ''
    throw new Error(`<Instance> component not found: ${label}`)
  }
  const overrides = propsToOverrides(tree.props, false, parentLayout)
  return (
    graph.createInstance(component.id, parentId, overrides) ?? graph.createNode('FRAME', parentId)
  )
}

async function renderNode(graph: SceneGraph, tree: TreeNode, parentId: string): Promise<SceneNode> {
  if (tree.type === 'icon') return renderIconNode(graph, tree, parentId)
  if (tree.type === 'instance') return renderInstanceNode(graph, tree, parentId)

  const nodeType = TYPE_MAP[tree.type]
  if (!nodeType) throw new Error(`Unknown element: <${tree.type}>`)

  const parent = graph.getNode(parentId)
  const parentLayout = parent?.layoutMode ?? 'NONE'

  const isText = nodeType === 'TEXT'
  const overrides = propsToOverrides(tree.props, isText, parentLayout)

  if (isText) {
    const childText = tree.children.filter((c): c is string => typeof c === 'string').join('')
    const propText =
      tree.props.text ??
      tree.props.characters ??
      tree.props.content ??
      tree.props.label ??
      tree.props.value ??
      tree.props.title
    if (childText) overrides.text = childText
    else if (typeof propText === 'string') overrides.text = propText
  }

  const node = graph.createNode(nodeType, parentId, overrides)

  for (const child of tree.children) {
    if (typeof child === 'string') continue
    if (isTreeNode(child)) {
      await renderNode(graph, child, node.id)
    }
  }

  if (node.type === 'COMPONENT_SET') inferComponentSetProperties(graph, node.id)

  return node
}
