import type { SceneGraph } from './index'

export interface SceneMutationImpact {
  changedNodeIds: Set<string>
  previousParentIds: Set<string>
  currentParentIds: Set<string>
  createdNodeIds: Set<string>
  deletedNodeIds: Set<string>
}

export function createSceneMutationImpact(): SceneMutationImpact {
  return {
    changedNodeIds: new Set(),
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

/** Collects the actual graph nodes and parent containers touched by an operation. */
export async function collectSceneMutation<T>(
  graph: SceneGraph,
  operation: () => T | Promise<T>
): Promise<CollectedSceneMutation<T>> {
  const impact = createSceneMutationImpact()
  const unbind = graph.onNodeEvents({
    created: (node) => {
      impact.createdNodeIds.add(node.id)
      impact.changedNodeIds.add(node.id)
      if (node.parentId) impact.currentParentIds.add(node.parentId)
    },
    updated: (id) => impact.changedNodeIds.add(id),
    deleted: (id, parentId) => {
      if (parentId) impact.previousParentIds.add(parentId)
      impact.deletedNodeIds.add(id)
      impact.changedNodeIds.add(id)
    },
    reparented: (nodeId, oldParentId, newParentId) => {
      impact.changedNodeIds.add(nodeId)
      if (oldParentId) impact.previousParentIds.add(oldParentId)
      impact.currentParentIds.add(newParentId)
    },
    reordered: (nodeId, parentId, _index, previousParentId) => {
      impact.changedNodeIds.add(nodeId)
      if (previousParentId && previousParentId !== parentId) {
        impact.previousParentIds.add(previousParentId)
      }
      impact.currentParentIds.add(parentId)
    }
  })
  try {
    return { result: await operation(), impact }
  } finally {
    unbind()
  }
}

export function mutationLayoutScopeIds(impact: SceneMutationImpact): string[] {
  return [
    ...new Set([...impact.changedNodeIds, ...impact.previousParentIds, ...impact.currentParentIds])
  ]
}
