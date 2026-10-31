import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { CONNECTOR_ELEMENT, resolveConnectorEnds } from './connectors'
import { RenderOrder } from './order'
import { LayerRefs } from './refs'
import { renderNode } from './renderer'
import type { DesignJSXServices } from './services'
import { FRAGMENT, isTreeNode, type TreeNode } from './tree'
import type { RenderOptions } from './types'
import { applyVariableDefinitions } from './variables/graph'

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

  const originalChildIds = new Set(graph.getNode(parentId)?.childIds)
  const originalChildCount = originalChildIds.size
  // By each root's position in `roots`: a fragment may list one element twice.
  const nodes: SceneNode[] = []
  const eventsByRoot: Array<Array<[TreeNode, SceneNode]>> = []
  const connectorsByRoot: Array<Array<{ node: SceneNode; tree: TreeNode }>> = []
  const context = { refs: new LayerRefs(), order: new RenderOrder() }
  const { refs } = context
  try {
    for (const index of context.order.of(roots)) {
      const events: Array<[TreeNode, SceneNode]> = []
      const connectors: Array<{ node: SceneNode; tree: TreeNode }> = []
      eventsByRoot[index] = events
      connectorsByRoot[index] = connectors
      const onNode = (element: TreeNode, node: SceneNode) => {
        if (element.type === CONNECTOR_ELEMENT) connectors.push({ node, tree: element })
        else refs.mark(element.props.ref, node)
        events.push([element, node])
      }
      const node = await renderNode(
        services,
        graph,
        roots[index],
        parentId,
        onNode,
        undefined,
        context
      )
      if (options.x !== undefined) graph.updateNode(node.id, { x: options.x })
      if (options.y !== undefined) graph.updateNode(node.id, { y: options.y })
      nodes[index] = node
    }
  } catch (error) {
    // A failed render leaves nothing behind, roots rendered before the failing one included.
    for (const child of graph.getChildren(parentId))
      if (!originalChildIds.has(child.id)) graph.deleteNode(child.id)
    throw error
  }

  nodes.forEach((node, index) => graph.insertChildAt(node.id, parentId, originalChildCount + index))
  for (const events of eventsByRoot) {
    for (const [element, node] of events) options.onNode?.(element, node)
  }
  const connectors = connectorsByRoot.flat()
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
