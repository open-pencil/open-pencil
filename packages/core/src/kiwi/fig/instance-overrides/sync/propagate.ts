import type { SceneGraph } from '@open-pencil/scene-graph'

import type { ProtectionMap } from '#core/kiwi/fig/instance-overrides/patches'

import { buildClonesMap, syncChildrenDeep } from './clones'
import { syncNodeProps } from './fields'

function expandSeedsToParents(graph: SceneGraph, seeds: Set<string>): Set<string> {
  const expanded = new Set(seeds)
  for (const seedId of seeds) {
    let cur = graph.getNode(seedId)
    while (cur?.parentId) {
      const parent = graph.getNode(cur.parentId)
      if (!parent) break
      if (parent.type === 'INSTANCE' || parent.type === 'COMPONENT') expanded.add(parent.id)
      cur = parent
    }
  }
  return expanded
}

function buildNeedsSyncSet(
  expandedSeeds: Set<string>,
  clonesOf: Map<string, string[]>
): Set<string> {
  const needsSync = new Set<string>()
  const queue = [...expandedSeeds]
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    const clones = clonesOf.get(id)
    if (!clones) continue
    for (const cloneId of clones) {
      if (needsSync.has(cloneId)) continue
      needsSync.add(cloneId)
      queue.push(cloneId)
    }
  }
  return needsSync
}

export function propagateOverridesTransitively(
  graph: SceneGraph,
  seeds: Set<string>,
  swappedInstances: Set<string>,
  componentIdRoot: Map<string, string>,
  protect?: Set<string>,
  activeNodeIds?: Set<string>,
  protections?: ProtectionMap
): void {
  if (seeds.size === 0) return

  componentIdRoot.clear()
  const clonesOf = buildClonesMap(graph, activeNodeIds)
  const expandedSeeds = expandSeedsToParents(graph, seeds)
  const needsSync = buildNeedsSyncSet(expandedSeeds, clonesOf)
  const skip = protect && protect.size > 0 ? new Set([...seeds, ...protect]) : seeds

  const visited = new Set<string>()
  const syncQueue = [...expandedSeeds]
  let index = 0
  while (index < syncQueue.length) {
    const sourceId = syncQueue[index]
    index++
    const clones = clonesOf.get(sourceId)
    if (!clones) continue
    const source = graph.getNode(sourceId)
    if (!source) continue

    for (const cloneId of clones) {
      if (!needsSync.has(cloneId) || visited.has(cloneId)) continue
      visited.add(cloneId)
      const node = graph.getNode(cloneId)
      if (!node) continue

      if (skip.has(cloneId)) {
        syncQueue.push(cloneId)
        continue
      }

      syncNodeProps(graph, source, node, protections)
      if (source.childIds.length !== node.childIds.length) {
        for (const childId of Array.from(node.childIds)) graph.deleteNode(childId)
        if (source.childIds.length > 0) graph.populateInstanceChildren(node.id, sourceId)
      } else if (source.childIds.length > 0 && node.childIds.length > 0) {
        syncChildrenDeep(graph, sourceId, node.id, swappedInstances, skip, protections)
      }
      syncQueue.push(cloneId)
    }
  }
}
