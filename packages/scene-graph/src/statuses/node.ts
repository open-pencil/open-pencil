import type { SceneGraph } from '../graph'
import type { NodeType, SceneNode } from '../types'

/** Layers Figma lets carry a status, `DevStatusMixin` in the Plugin API. */
export const STATUS_NODE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'SECTION',
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

const STATUS_PARENT_TYPES: ReadonlySet<NodeType> = new Set<NodeType>(['CANVAS', 'SECTION'])

/**
 * Whether a layer can show a status where it is, and if not, why:
 * - `type`: the kind of layer never has one;
 * - `parent`: it is not directly on a page or in a section;
 * - `ancestor`: a section around it shows a status of its own.
 */
export type StatusPlacement = 'ok' | 'type' | 'parent' | 'ancestor'

function isPlacedForStatus(graph: SceneGraph, node: SceneNode): boolean {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  return (
    STATUS_NODE_TYPES.has(node.type) && parent !== undefined && STATUS_PARENT_TYPES.has(parent.type)
  )
}

/** The layer and its ancestors below the page, outermost first. */
function sectionChain(graph: SceneGraph, node: SceneNode): SceneNode[] {
  const chain: SceneNode[] = []
  graph.closest(node.id, (current) => {
    if (current.type === 'CANVAS' || current.id === graph.rootId) return true
    chain.push(current)
    return false
  })
  return chain.reverse()
}

/** The outermost layer from `node` up whose status shows; it hides every status inside it. */
function showingStatusOwner(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  return sectionChain(graph, node).find(
    (current) => current.status !== null && isPlacedForStatus(graph, current)
  )
}

export function statusPlacement(graph: SceneGraph, node: SceneNode): StatusPlacement {
  if (!STATUS_NODE_TYPES.has(node.type)) return 'type'
  if (!isPlacedForStatus(graph, node)) return 'parent'
  const owner = showingStatusOwner(graph, node)
  return owner && owner.id !== node.id ? 'ancestor' : 'ok'
}

/**
 * The state id a layer shows. As in Figma, a status stays stored while the layer sits where it
 * cannot show one, inside a frame or in a section showing its own, and shows again once the
 * layer is back on a page or in a plain section.
 */
export function effectiveStatus(graph: SceneGraph, node: SceneNode): string | null {
  if (!node.status) return null
  return showingStatusOwner(graph, node)?.id === node.id ? node.status : null
}
