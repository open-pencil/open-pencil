// Pairing an instance's children with its component's before a sync copies fields across.
import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'
import {
  copiedComponentLayerId,
  setInstanceOverride,
  type InstanceOverrideState
} from './overrides'

function linkMatchedChild(
  overrides: InstanceOverrideState,
  instParentId: string,
  instChild: SceneNode,
  compChildId: string
): void {
  if (instChild.type === 'INSTANCE') {
    setInstanceOverride(overrides, instParentId, instChild.id, 'sourceComponentId', compChildId)
  } else {
    instChild.componentId = compChildId
  }
}

/** Children no link pairs, matched by type and name where the counts leave no doubt. */
export function matchFallbackChildren(
  graph: SceneGraph,
  compParent: SceneNode,
  instParent: SceneNode,
  instParentId: string,
  overrides: InstanceOverrideState,
  instChildMap: Map<string, SceneNode>,
  usedInstChildIds: Set<string>
): void {
  const fallbackByType = new Map<SceneNode['type'], Map<string, SceneNode[]>>()
  const remainingCandidateCount = new Map<SceneNode['type'], number>()
  const unmatchedComponentCount = new Map<SceneNode['type'], number>()
  for (const compChildId of compParent.childIds) {
    if (instChildMap.has(compChildId)) continue
    const child = graph.nodes.get(compChildId)
    if (child) {
      unmatchedComponentCount.set(child.type, (unmatchedComponentCount.get(child.type) ?? 0) + 1)
    }
  }
  for (const childId of instParent.childIds) {
    const child = graph.nodes.get(childId)
    if (!child || usedInstChildIds.has(child.id)) continue
    remainingCandidateCount.set(child.type, (remainingCandidateCount.get(child.type) ?? 0) + 1)
    let byName = fallbackByType.get(child.type)
    if (!byName) {
      byName = new Map()
      fallbackByType.set(child.type, byName)
    }
    const queue = byName.get(child.name)
    if (queue) queue.push(child)
    else byName.set(child.name, [child])
  }

  // Match by name and type with FIFO queues to preserve sibling order in linear time.
  for (const compChildId of compParent.childIds) {
    if (instChildMap.has(compChildId)) continue
    const compChild = graph.nodes.get(compChildId)
    if (!compChild) continue
    const candidatesByName = fallbackByType.get(compChild.type)
    const candidateCount = remainingCandidateCount.get(compChild.type) ?? 0
    if (candidateCount > (unmatchedComponentCount.get(compChild.type) ?? 0)) continue
    const match = candidatesByName?.get(compChild.name)?.shift()
    if (!match) continue
    remainingCandidateCount.set(compChild.type, candidateCount - 1)
    instChildMap.set(compChildId, match)
    usedInstChildIds.add(match.id)
    linkMatchedChild(overrides, instParentId, match, compChildId)
  }
}

/** Children already linked to a component child by sourceComponentId or componentId. */
export function matchLinkedChildren(
  graph: SceneGraph,
  instParent: SceneNode,
  instParentId: string,
  overrides: InstanceOverrideState,
  compChildIdSet: ReadonlySet<string>,
  instChildMap: Map<string, SceneNode>,
  usedInstChildIds: Set<string>
): void {
  for (const childId of instParent.childIds) {
    const child = graph.nodes.get(childId)
    if (!child) continue
    const mappedComponentId = copiedComponentLayerId(overrides, instParentId, child)
    if (mappedComponentId && compChildIdSet.has(mappedComponentId)) {
      instChildMap.set(mappedComponentId, child)
      usedInstChildIds.add(child.id)
    }
  }
}
