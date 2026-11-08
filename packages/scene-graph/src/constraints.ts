import { FITTED_CONTAINER_TYPES } from './node-defaults'
import type { ConstraintType, SceneNode } from './types'

interface ConstraintGraph {
  getNode(id: string): SceneNode | undefined
}

/** Containers whose children keep their place by their own constraints when they resize. */
export const CONSTRAINT_PARENT_TYPES: ReadonlySet<SceneNode['type']> = new Set<SceneNode['type']>([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/**
 * The frame, component, or instance whose resize moves `node` by its constraints: its parent, or,
 * for a layer in groups and booleans, the frame around the outermost of them, as in Figma (live,
 * #1835). Null when nothing places it by constraints: on a page or in a section, or in an auto
 * layout flow.
 */
export function constraintFrame(graph: ConstraintGraph, node: SceneNode): SceneNode | null {
  let layer = node
  let parent = node.parentId ? graph.getNode(node.parentId) : undefined
  while (parent && FITTED_CONTAINER_TYPES.has(parent.type)) {
    layer = parent
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
  if (!parent || !CONSTRAINT_PARENT_TYPES.has(parent.type)) return null
  if (parent.layoutMode !== 'NONE' && layer.layoutPositioning !== 'ABSOLUTE') return null
  return parent
}

/** Whether `node` has constraints the Design panel offers and the canvas shows. */
export function isConstraintEligible(graph: ConstraintGraph, node: SceneNode): boolean {
  return constraintFrame(graph, node) !== null
}

/**
 * The layers whose constraints `node` stands for. A group or boolean has none of its own: it shows
 * and sets those of the layers in it, through nested groups and booleans, as in Figma.
 */
export function constraintLayers(graph: ConstraintGraph, node: SceneNode): SceneNode[] {
  if (!FITTED_CONTAINER_TYPES.has(node.type)) return [node]
  return node.childIds.flatMap((id) => {
    const child = graph.getNode(id)
    return child ? constraintLayers(graph, child) : []
  })
}

/** The constraint the layers share on one axis, or null when they differ or there are none. */
export function sharedConstraint(
  layers: readonly SceneNode[],
  key: 'horizontalConstraint' | 'verticalConstraint'
): ConstraintType | null {
  const first = layers.at(0)?.[key]
  if (first === undefined) return null
  return layers.every((layer) => layer[key] === first) ? first : null
}
