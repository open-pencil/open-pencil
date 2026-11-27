import { uniq } from 'es-toolkit/array'

import { LAYOUT_NEUTRAL_FIELDS } from './fields/layout'
import type { SceneGraph } from './graph'
import type { SceneNode } from './types'

export interface SceneMutationImpact {
  changedNodeIds: Set<string>
  /** Changed nodes whose edit can move layers: all of them but those renamed, locked, and the like. */
  layoutNodeIds: Set<string>
  previousParentIds: Set<string>
  currentParentIds: Set<string>
  createdNodeIds: Set<string>
  deletedNodeIds: Set<string>
}

export function createSceneMutationImpact(): SceneMutationImpact {
  return {
    changedNodeIds: new Set(),
    layoutNodeIds: new Set(),
    previousParentIds: new Set(),
    currentParentIds: new Set(),
    createdNodeIds: new Set(),
    deletedNodeIds: new Set()
  }
}

export type MutationImpactListener = (impact: SceneMutationImpact) => void

export interface CollectedSceneMutation<T> {
  result: T
  impact: SceneMutationImpact
}

function changed(impact: SceneMutationImpact, id: string): void {
  impact.changedNodeIds.add(id)
  impact.layoutNodeIds.add(id)
}

function movesLayers(changes: Partial<SceneNode>): boolean {
  return Object.keys(changes).some((field) => !LAYOUT_NEUTRAL_FIELDS.has(field))
}

/** Records into `impact` the nodes and parent containers the graph's edits touch, until unbound. */
export function recordSceneMutations(
  graph: SceneGraph,
  impact: SceneMutationImpact,
  shouldRecord: () => boolean = () => true
): () => void {
  return graph.onNodeEvents({
    created: (node) => {
      if (!shouldRecord()) return
      impact.createdNodeIds.add(node.id)
      changed(impact, node.id)
      if (node.parentId) impact.currentParentIds.add(node.parentId)
    },
    updated: (id, changes) => {
      if (!shouldRecord()) return
      impact.changedNodeIds.add(id)
      if (movesLayers(changes)) impact.layoutNodeIds.add(id)
    },
    deleted: (id, parentId) => {
      if (!shouldRecord()) return
      if (parentId) impact.previousParentIds.add(parentId)
      impact.deletedNodeIds.add(id)
      changed(impact, id)
    },
    reparented: (nodeId, oldParentId, newParentId) => {
      if (!shouldRecord()) return
      changed(impact, nodeId)
      if (oldParentId) impact.previousParentIds.add(oldParentId)
      impact.currentParentIds.add(newParentId)
    },
    reordered: (nodeId, parentId, _index, previousParentId) => {
      if (!shouldRecord()) return
      changed(impact, nodeId)
      if (previousParentId && previousParentId !== parentId) {
        impact.previousParentIds.add(previousParentId)
      }
      impact.currentParentIds.add(parentId)
    }
  })
}

/** Collects the actual graph nodes and parent containers touched by an operation. */
export async function collectSceneMutation<T>(
  graph: SceneGraph,
  operation: () => T | Promise<T>
): Promise<CollectedSceneMutation<T>> {
  const impact = createSceneMutationImpact()
  const unbind = recordSceneMutations(graph, impact)
  try {
    return { result: await operation(), impact }
  } finally {
    unbind()
  }
}

export function mutationLayoutScopeIds(impact: SceneMutationImpact): string[] {
  return uniq([...impact.layoutNodeIds, ...impact.previousParentIds, ...impact.currentParentIds])
}
