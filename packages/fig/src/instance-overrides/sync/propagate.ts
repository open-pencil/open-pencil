import type { SceneGraph } from '@open-pencil/scene-graph'

import { isFieldProtected, type ProtectionMap } from '../patches'
import { buildClonesMap, syncChildrenDeep } from './clones'
import { syncNodeProps } from './fields'
import { indexCloneSubtree, remapRepopulatedChildSources, snapshotChildSources } from './sources'

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

interface NodePropPropagationEntry {
  lineageId: string
  sourceId: string
}

function mergeCloneLineage(
  current: Map<string, string[]>,
  preComputed?: Map<string, string[]>
): Map<string, string[]> {
  if (!preComputed) return current
  const merged = new Map<string, string[]>()
  for (const source of [preComputed, current]) {
    for (const [sourceId, cloneIds] of source) {
      const existing = merged.get(sourceId)
      if (existing) {
        for (const cloneId of cloneIds) {
          if (!existing.includes(cloneId)) existing.push(cloneId)
        }
      } else {
        merged.set(sourceId, [...cloneIds])
      }
    }
  }
  return merged
}

export function propagateNodePropsTransitively(
  graph: SceneGraph,
  seeds: Set<string>,
  activeNodeIds?: Set<string>,
  protections?: ProtectionMap,
  preComputedClones?: Map<string, string[]>
): void {
  if (seeds.size === 0) return

  const clonesOf = mergeCloneLineage(buildClonesMap(graph, activeNodeIds), preComputedClones)
  const visited = new Set(seeds)
  const queue: NodePropPropagationEntry[] = [...seeds].map((id) => ({
    lineageId: id,
    sourceId: id
  }))
  let index = 0
  while (index < queue.length) {
    const { lineageId, sourceId } = queue[index]
    index++
    const source = graph.getNode(sourceId)
    if (!source) continue
    for (const cloneId of clonesOf.get(lineageId) ?? []) {
      if (visited.has(cloneId)) continue
      visited.add(cloneId)
      const clone = graph.getNode(cloneId)
      if (clone) syncNodeProps(graph, source, clone, protections)
      queue.push({ lineageId: cloneId, sourceId: clone?.id ?? sourceId })
    }
  }
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
        // A directly overridden clone may still inherit effective text from an
        // overridden source. Respect its own text override when present.
        if (
          source.type === 'TEXT' &&
          node.type === 'TEXT' &&
          !isFieldProtected(protections, node.id, 'text')
        ) {
          graph.updateNode(node.id, { text: source.text })
        }
        syncQueue.push(cloneId)
        continue
      }

      syncNodeProps(graph, source, node, protections)
      if (source.childIds.length !== node.childIds.length) {
        const previousSources = snapshotChildSources(graph, node.id)
        for (const childId of Array.from(node.childIds)) graph.deleteNode(childId)
        if (source.childIds.length > 0) {
          graph.populateInstanceChildren(node.id, sourceId, 'fig-import')
          indexCloneSubtree(graph, node.id, clonesOf)
        }
        remapRepopulatedChildSources(graph, node.id, previousSources, clonesOf, activeNodeIds)
      } else if (source.childIds.length > 0 && node.childIds.length > 0) {
        syncChildrenDeep(
          graph,
          sourceId,
          node.id,
          swappedInstances,
          skip,
          protections,
          clonesOf,
          activeNodeIds
        )
      }
      syncQueue.push(cloneId)
    }
  }
}
