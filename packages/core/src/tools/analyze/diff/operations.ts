import { union } from 'es-toolkit'
import type { Delta } from 'jsondiffpatch'

import type { ProjectedNode } from './projection'

/** One edit to a node tree; together they turn the old tree into the new one. */
export type DiffOperation =
  | {
      kind: 'update'
      path: string
      id: string
      /** Attribute sources the node has now and loses. */
      removed: string[]
      /** Attribute sources the node gains. */
      added: string[]
    }
  | { kind: 'remove'; path: string; id: string }
  | { kind: 'move'; path: string; id: string; index: number }
  | { kind: 'add'; path: string; parentId: string; index: number; jsx: string }

// jsondiffpatch documents its delta shapes; its type guards are not exported at runtime.
type ObjectDelta = Record<string, Delta>
const isObjectDelta = (delta: unknown): delta is ObjectDelta =>
  typeof delta === 'object' && delta !== null && !Array.isArray(delta)
const isAdded = (delta: unknown): delta is [unknown] => Array.isArray(delta) && delta.length === 1
const isDeleted = (delta: unknown): delta is [unknown, 0, 0] =>
  Array.isArray(delta) && delta.length === 3 && delta[2] === 0
const isMoved = (delta: unknown): delta is [unknown, number, 3] =>
  Array.isArray(delta) && delta.length === 3 && delta[2] === 3

/** Paths are for reading; IDs locate nodes, so a name's line breaks can become spaces. */
function childPath(parentPath: string, node: ProjectedNode): string {
  return `${parentPath}/${node.name.replace(/[\r\n]+/g, ' ')}`
}

function attributeChanges(before: ProjectedNode, after: ProjectedNode) {
  const names = union(Object.keys(before.attributes), Object.keys(after.attributes))
  const removed: string[] = []
  const added: string[] = []
  for (const name of names) {
    const from = before.attributes[name] as string | undefined
    const to = after.attributes[name] as string | undefined
    if (from === to) continue
    if (from !== undefined) removed.push(from)
    if (to !== undefined) added.push(to)
  }
  return { removed, added }
}

interface Walk {
  /** JSX for an added node, by its ID in the new tree. */
  jsxFor: (id: string) => string
  out: DiffOperation[]
}

function childOperations(
  delta: ObjectDelta,
  before: ProjectedNode,
  after: ProjectedNode,
  path: string,
  walk: Walk
): void {
  const oldChildren = before.children ?? []
  const newChildren = after.children ?? []
  const removals: DiffOperation[] = []
  // Array deltas key removals and moves by old index, additions and edits by new index.
  for (const [key, change] of Object.entries(delta)) {
    if (key === '_t') continue
    if (key.startsWith('_')) {
      const child = oldChildren[Number(key.slice(1))]
      if (isDeleted(change))
        removals.push({ kind: 'remove', path: childPath(path, child), id: child.id })
      else if (isMoved(change)) {
        walk.out.push({
          kind: 'move',
          path: childPath(path, child),
          id: child.id,
          index: change[1]
        })
      }
      continue
    }
    const index = Number(key)
    const child = newChildren[index]
    if (isAdded(change)) {
      const jsx = walk.jsxFor(child.id)
      walk.out.push({ kind: 'add', path: childPath(path, child), parentId: before.id, index, jsx })
      continue
    }
    const counterpart = oldChildren.find((item) => item.key === child.key)
    if (counterpart) nodeOperations(change, counterpart, child, childPath(path, counterpart), walk)
  }
  walk.out.push(...removals)
}

function nodeOperations(
  delta: Delta,
  before: ProjectedNode,
  after: ProjectedNode,
  path: string,
  walk: Walk
): void {
  if (!isObjectDelta(delta)) return
  if (delta.attributes) {
    walk.out.push({ kind: 'update', path, id: before.id, ...attributeChanges(before, after) })
  }
  if (isObjectDelta(delta.children)) childOperations(delta.children, before, after, path, walk)
}

/** The edits a delta between two projected trees describes, applying to the old tree. */
export function deltaOperations(
  delta: Delta,
  before: ProjectedNode,
  after: ProjectedNode,
  jsxFor: (id: string) => string
): DiffOperation[] {
  const walk: Walk = { jsxFor, out: [] }
  nodeOperations(delta, before, after, childPath('', before), walk)
  return walk.out
}
