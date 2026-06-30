import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { ProtectionMap } from '#core/kiwi/fig/instance-overrides/patches'

import { syncNodeProps } from './fields'

export function recloneChildren(
  graph: SceneGraph,
  srcChildId: string,
  tgtNode: SceneNode,
  swappedInstances: Set<string>,
  protections?: ProtectionMap
): void {
  const srcChild = graph.getNode(srcChildId)
  if (!srcChild) return

  for (const childId of Array.from(tgtNode.childIds)) graph.deleteNode(childId)
  graph.updateNode(tgtNode.id, { name: srcChild.name, componentId: srcChild.componentId })
  syncNodeProps(graph, srcChild, tgtNode, protections)
  if (srcChild.childIds.length > 0) graph.populateInstanceChildren(tgtNode.id, srcChildId)
  swappedInstances.add(tgtNode.id)
}

export function syncChildrenDeep(
  graph: SceneGraph,
  sourceId: string,
  targetId: string,
  swappedInstances: Set<string>,
  skip?: Set<string>,
  protections?: ProtectionMap
): void {
  const src = graph.getNode(sourceId)
  const tgt = graph.getNode(targetId)
  if (!src || !tgt) return
  const len = Math.min(src.childIds.length, tgt.childIds.length)
  for (let i = 0; i < len; i++) {
    if (skip?.has(tgt.childIds[i])) continue
    const srcNode = graph.getNode(src.childIds[i])
    const tgtNode = graph.getNode(tgt.childIds[i])
    if (!srcNode || !tgtNode || srcNode.type !== tgtNode.type) continue

    if (srcNode.type === 'INSTANCE' && srcNode.componentId !== tgtNode.componentId) {
      recloneChildren(graph, src.childIds[i], tgtNode, swappedInstances, protections)
      continue
    }

    syncNodeProps(graph, srcNode, tgtNode, protections)
    syncChildrenDeep(graph, src.childIds[i], tgt.childIds[i], swappedInstances, skip, protections)
  }
}

export function buildClonesMap(
  graph: SceneGraph,
  activeNodeIds?: Set<string>
): Map<string, string[]> {
  const clonesOf = new Map<string, string[]>()
  for (const node of graph.getAllNodes()) {
    if (activeNodeIds && !activeNodeIds.has(node.id)) continue
    if (!node.componentId) continue
    let arr = clonesOf.get(node.componentId)
    if (!arr) {
      arr = []
      clonesOf.set(node.componentId, arr)
    }
    arr.push(node.id)
  }
  return clonesOf
}
