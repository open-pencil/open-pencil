import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { removeComponentProperty } from '@open-pencil/scene-graph/components'

import { CONNECTOR_ELEMENT, resolveConnectorEnds } from '../figjam/connectors'
import { LayerRefs } from '../refs'
import type { DesignJSXServices } from '../services'
import { FRAGMENT, isTreeNode, type TreeNode } from '../tree'
import { applyVariableDefinitions } from '../variables/graph'
import { renderNode, type RenderContext } from './node'
import { RenderOrder } from './order'
import type { RenderOptions } from './types'

export interface RenderResult {
  id: string
  name: string
  type: NodeType
  childIds: string[]
  warnings?: string[]
}

/** `nodeId` and the layers it is in, nearest first. */
function ancestors(graph: SceneGraph, nodeId: string): SceneNode[] {
  const node = graph.getNode(nodeId)
  return node ? [node, ...ancestors(graph, node.parentId ?? '')] : []
}

/** The nodes a tree renders as: a fragment's children, or the tree itself. */
function treeRoots(tree: TreeNode): TreeNode[] {
  return tree.type === FRAGMENT ? tree.children.filter(isTreeNode) : [tree]
}

/**
 * What puts back the layers a render into `parentId` creates and the property definitions
 * `property()` adds to the components around the parent. Only the render's own: another hand may
 * add to the parent or its components while it renders.
 */
function undoRender(graph: SceneGraph, parentId: string, context: RenderContext): () => void {
  const owners = ancestors(graph, parentId).filter(
    (node) => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
  )
  return () => {
    for (const id of context.created) graph.deleteNode(id)
    const added = new Set(context.properties)
    // As removing a property in the editor does: layers bound to it meanwhile are unbound.
    for (const { id } of owners) {
      for (const definition of graph.getNode(id)?.componentPropertyDefinitions ?? []) {
        if (added.has(definition.id)) removeComponentProperty(graph, id, definition.id)
      }
    }
  }
}

/** The render in flight on each graph, which the next waits for. */
const rendering = new WeakMap<SceneGraph, Promise<unknown>>()

/**
 * Render every root of `tree` into the parent and lay out once. Renders into one graph run one
 * after another, so a failed render puts back only what it changed.
 */
export function renderRoots<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  options: RenderOptions = {}
): Promise<RenderResult[]> {
  const previous = rendering.get(graph) ?? Promise.resolve()
  const render = previous
    .catch(() => undefined)
    .then(() => renderRootsNow(services, graph, tree, options))
  rendering.set(graph, render)
  return render
}

async function renderRootsNow<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  tree: TreeNode,
  options: RenderOptions
): Promise<RenderResult[]> {
  const roots = treeRoots(tree)
  if (roots.length === 0) throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  const parentId = options.parentId ?? graph.getPages()[0].id
  const context: RenderContext = {
    refs: new LayerRefs(),
    order: new RenderOrder(),
    warnings: [],
    created: [],
    properties: []
  }
  // Variables apply by name, so a failed render's stay and the next render reuses them.
  applyVariableDefinitions(graph, tree)
  const undo = undoRender(graph, parentId, context)
  try {
    return await renderInto(services, graph, roots, parentId, options, context)
  } catch (error) {
    // A failed render leaves no layers behind, roots rendered before the failing one included.
    undo()
    throw error
  }
}

async function renderInto<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  roots: TreeNode[],
  parentId: string,
  options: RenderOptions,
  context: RenderContext
): Promise<RenderResult[]> {
  const originalChildCount = graph.getChildren(parentId).length
  // By each root's position in `roots`: a fragment may list one element twice.
  const nodes: SceneNode[] = []
  const eventsByRoot: Array<Array<[TreeNode, SceneNode]>> = []
  const connectorsByRoot: Array<Array<{ node: SceneNode; tree: TreeNode }>> = []
  const { refs } = context
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

  nodes.forEach((node, index) => graph.insertChildAt(node.id, parentId, originalChildCount + index))
  for (const events of eventsByRoot) {
    for (const [element, node] of events) options.onNode?.(element, node)
  }
  const connectors = connectorsByRoot.flat()
  const rootIds = nodes.map((node) => node.id)
  const warnings = [
    ...refs.warnings,
    ...context.warnings,
    ...resolveConnectorEnds(graph, rootIds, connectors, refs)
  ]
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
