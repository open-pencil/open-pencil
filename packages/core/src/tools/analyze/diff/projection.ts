import { create, type Delta } from 'jsondiffpatch'

import { sceneNodeAttributes } from '@open-pencil/design-jsx'
import type { NodeType, SceneGraph } from '@open-pencil/scene-graph'

export const DEFAULT_DIFF_DEPTH = 10

/**
 * How nodes find their counterparts: by ID between two states of one document, or by name
 * path between copies and files, whose IDs differ.
 */
export type DiffMatch = 'id' | 'path'

/** A node as the diff sees it: its JSX attributes and its children. */
export interface ProjectedNode {
  id: string
  /** Matches the node to its counterpart: its ID, or its type and name, counting repeats. */
  key: string
  type: NodeType
  name: string
  /** Attribute sources by name, as the JSX export prints them; empty for nodes it skips. */
  attributes: Record<string, string>
  /** `null` past the depth limit, so children that were not visited never read as removed. */
  children: ProjectedNode[] | null
}

export interface ProjectOptions {
  match: DiffMatch
  /** Levels of children to include (default: unlimited). */
  depth?: number
}

function projectNode(
  graph: SceneGraph,
  id: string,
  key: string,
  match: DiffMatch,
  depth: number
): ProjectedNode | null {
  const node = graph.getNode(id)
  if (!node) return null
  const attributes = Object.fromEntries(
    (sceneNodeAttributes(id, graph) ?? []).map(({ name, source }) => [name, source])
  )
  let children: ProjectedNode[] | null = null
  if (depth > 0) {
    // Number repeated names so each sibling matches its counterpart, not its namesake.
    const seen = new Map<string, number>()
    children = node.childIds.flatMap((childId) => {
      const child = graph.getNode(childId)
      if (!child) return []
      const base = `${child.type}:${child.name}`
      const count = (seen.get(base) ?? 0) + 1
      seen.set(base, count)
      const pathKey = count > 1 ? `${base}[${count}]` : base
      return projectNode(graph, childId, match === 'id' ? childId : pathKey, match, depth - 1) ?? []
    })
  }
  return { id, key, type: node.type, name: node.name, attributes, children }
}

export function projectTree(
  graph: SceneGraph,
  rootId: string,
  options: ProjectOptions
): ProjectedNode | null {
  return projectNode(
    graph,
    rootId,
    rootId,
    options.match,
    options.depth ?? Number.POSITIVE_INFINITY
  )
}

function isProjectedNode(value: unknown): value is ProjectedNode {
  return typeof value === 'object' && value !== null && 'attributes' in value && 'key' in value
}

/** Labels, not state: a renamed node's `name` attribute carries the change. */
const NODE_LABELS = new Set(['id', 'name'])

const differ = create({
  objectHash: (item) => (isProjectedNode(item) ? item.key : undefined),
  arrays: { detectMove: true, includeValueOnMove: false },
  propertyFilter: (name, context) => !(NODE_LABELS.has(name) && isProjectedNode(context.left))
})

/** The jsondiffpatch delta between two projected trees; `undefined` when they match. */
export function diffProjections(before: ProjectedNode, after: ProjectedNode): Delta {
  return differ.diff(before, after)
}
