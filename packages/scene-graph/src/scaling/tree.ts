import type { SceneGraph } from '../graph'
import { findInstanceAncestor } from '../instances'
import type { SceneNode } from '../types'
import { scaleVariableBindingUnits } from '../variables/units'
import { scaleNodeChanges } from './node'

/** The smallest scale a node tree takes. */
export const MIN_RESCALE = 0.01

const RESCALABLE_NODE_TYPES = new Set<SceneNode['type']>([
  'BOOLEAN_OPERATION',
  'COMPONENT',
  'COMPONENT_SET',
  'ELLIPSE',
  'FRAME',
  'GROUP',
  'INSTANCE',
  'LINE',
  'POLYGON',
  'RECTANGLE',
  'STAR',
  'STICKY',
  'TEXT',
  'VECTOR'
])

export interface RescaleOptions {
  /**
   * Locked layers below the root, and everything inside them, keep their size and their place in
   * their parent, as Figma's Scale tool leaves them; the plugin API's `rescale()` scales them.
   */
  keepLocked?: boolean
}

/**
 * The selected layers the Scale tool scales: unlocked layers of a type that rescales, outside any
 * instance, and not inside another of them, which scales them with itself.
 */
export function scaleRoots(graph: SceneGraph, nodes: readonly SceneNode[]): SceneNode[] {
  const ids = new Set(nodes.map((node) => node.id))
  return nodes.filter((node) => {
    if (node.locked || !RESCALABLE_NODE_TYPES.has(node.type) || !node.parentId) return false
    if (findInstanceAncestor(graph, node.parentId)) return false
    return !graph.closest(node.parentId, (parent) => ids.has(parent.id))
  })
}

/** The root and every layer below it that a rescale changes, root first. */
export function rescaleTargets(
  graph: SceneGraph,
  root: SceneNode,
  { keepLocked = false }: RescaleOptions = {}
): SceneNode[] {
  const nodes: SceneNode[] = [root]
  const collect = (node: SceneNode): void => {
    for (const child of graph.getChildren(node.id)) {
      if (keepLocked && child.locked) continue
      nodes.push(child)
      collect(child)
    }
  }
  collect(root)
  return nodes
}

/**
 * What a rescale by `scale` writes to `node`: its own lengths and those of its bound variables,
 * the scale of an instance's occurrence, and, below the root, its place in its parent.
 */
export function rescaleNodeChanges(
  graph: SceneGraph,
  node: SceneNode,
  scale: number,
  isRoot: boolean
): Partial<SceneNode> {
  return {
    ...scaleNodeChanges(node, scale, !isRoot),
    ...scaleVariableBindingUnits(node, scale),
    componentScale: findInstanceAncestor(graph, node.id)
      ? node.componentScale * scale
      : node.componentScale
  }
}

/** Scale a node tree from the root node's top-left, matching Figma's `rescale()`. */
export function rescaleNodeTree(
  graph: SceneGraph,
  rootId: string,
  scale: number,
  options?: RescaleOptions
): void {
  if (!Number.isFinite(scale)) throw new TypeError('Scale must be a finite number')
  if (scale < MIN_RESCALE) throw new RangeError(`Scale must be at least ${MIN_RESCALE}`)
  const root = graph.getNode(rootId)
  if (!root || !RESCALABLE_NODE_TYPES.has(root.type))
    throw new Error('rescale() is not supported on this node')
  for (const node of rescaleTargets(graph, root, options)) {
    graph.updateNode(node.id, rescaleNodeChanges(graph, node, scale, node.id === rootId))
  }
}
