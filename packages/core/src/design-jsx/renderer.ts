import { parseColor } from '#core/color'
import { fetchIcons } from '#core/icons'
import { createIconFromPaths } from '#core/icons/render'
import { computeAllLayouts } from '#core/layout'
import type { SceneGraph, SceneNode, NodeType } from '#core/scene-graph'

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
  component: 'COMPONENT'
}

interface RenderOptions {
  x?: number
  y?: number
  parentId?: string
}

export interface RenderResult {
  id: string
  name: string
  type: NodeType
  childIds: string[]
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

async function renderNode(graph: SceneGraph, tree: TreeNode, parentId: string): Promise<SceneNode> {
  if (tree.type === 'icon') return renderIconNode(graph, tree, parentId)

  const nodeType = TYPE_MAP[tree.type]
  if (!nodeType) throw new Error(`Unknown element: <${tree.type}>`)

  const parent = graph.getNode(parentId)
  const parentLayout = parent?.layoutMode ?? 'NONE'

  const isText = nodeType === 'TEXT'
  const overrides = propsToOverrides(tree.props, isText, parentLayout)

  if (isText) {
    const textContent = tree.children.filter((c): c is string => typeof c === 'string').join('')
    if (textContent) overrides.text = textContent
  }

  const node = graph.createNode(nodeType, parentId, overrides)

  for (const child of tree.children) {
    if (typeof child === 'string') continue
    if (isTreeNode(child)) {
      await renderNode(graph, child, node.id)
    }
  }

  return node
}
