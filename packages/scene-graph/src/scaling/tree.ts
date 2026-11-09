import type { SceneGraph } from '../graph'
import { findInstanceAncestor } from '../instances'
import type { SceneNode } from '../types'
import { scaleVariableBindingUnits } from '../variables/units'
import { scaleNodeChanges } from './node'

const MIN_SCALE = 0.01
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

/** Whether a layer sits inside a component instance, which Figma's Scale tool does not reach. */
export function isInsideInstance(
  node: SceneNode,
  graph: Pick<SceneGraph, 'getNode'>
): boolean {
  for (let parentId = node.parentId; parentId; parentId = graph.getNode(parentId)?.parentId ?? null) {
    if (graph.getNode(parentId)?.type === 'INSTANCE') return true
  }
  return false
}

/** Whether a layer takes the Scale tool: a rescalable type that is not locked. */
export function canRescaleNode(node: SceneNode): boolean {
  return !node.locked && RESCALABLE_NODE_TYPES.has(node.type)
}

/** Scale a node tree from the root node's top-left, matching Figma's Scale tool. */
export function rescaleNodeTree(graph: SceneGraph, rootId: string, scale: number): void {
  if (!Number.isFinite(scale)) throw new TypeError('Scale must be a finite number')
  if (scale < MIN_SCALE) throw new RangeError(`Scale must be at least ${MIN_SCALE}`)
  const root = graph.getNode(rootId)
  if (!root || !RESCALABLE_NODE_TYPES.has(root.type))
    throw new Error('rescale() is not supported on this node')
  const nodes: SceneNode[] = [root]
  const collect = (node: SceneNode): void => {
    for (const childId of node.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      nodes.push(child)
      collect(child)
    }
  }
  collect(root)
  for (const node of nodes) {
    graph.updateNode(node.id, {
      ...scaleNodeChanges(node, scale, node.id !== rootId),
      ...scaleVariableBindingUnits(node, scale),
      componentScale: findInstanceAncestor(graph, node.id)
        ? node.componentScale * scale
        : node.componentScale
    })
  }
}
