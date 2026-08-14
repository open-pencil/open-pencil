import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { overrideCandidates } from '../utils'
import { cloneInstanceUpdate } from './clone-update'

interface ChildSourceSnapshot {
  id: string
  path: number[]
  type: SceneNode['type']
}

const refreshedCloneSourceMaps = new WeakSet<Map<string, string[]>>()
const cloneSourceIdCaches = new WeakMap<Map<string, string[]>, Map<string, Set<string>>>()

function cloneSourceIds(cloneSources: Map<string, string[]>): Map<string, Set<string>> {
  let cached = cloneSourceIdCaches.get(cloneSources)
  if (!cached) {
    cached = new Map([...cloneSources].map(([sourceId, cloneIds]) => [sourceId, new Set(cloneIds)]))
    cloneSourceIdCaches.set(cloneSources, cached)
  }
  return cached
}

// SceneGraph.instanceIndex contains INSTANCE nodes only, while generated text,
// frame, and vector descendants also use componentId as clone provenance.
function refreshCloneSources(
  graph: SceneGraph,
  cloneSources: Map<string, string[]>,
  activeNodeIds?: Set<string>
): void {
  if (refreshedCloneSourceMaps.has(cloneSources)) return
  const knownIds = cloneSourceIds(cloneSources)
  for (const node of overrideCandidates(graph, activeNodeIds)) {
    if (!node.componentId) continue
    let known = knownIds.get(node.componentId)
    if (!known) {
      known = new Set()
      knownIds.set(node.componentId, known)
      cloneSources.set(node.componentId, [])
    }
    if (known.has(node.id)) continue
    known.add(node.id)
    cloneSources.get(node.componentId)?.push(node.id)
  }
  refreshedCloneSourceMaps.add(cloneSources)
}

export function indexCloneNodes(
  graph: SceneGraph,
  nodeIds: Iterable<string>,
  cloneSources: Map<string, string[]>
): void {
  const knownIds = cloneSourceIds(cloneSources)
  for (const nodeId of nodeIds) {
    const node = graph.getNode(nodeId)
    if (!node?.componentId) continue
    let known = knownIds.get(node.componentId)
    if (!known) {
      known = new Set()
      knownIds.set(node.componentId, known)
    }
    if (known.has(node.id)) continue
    known.add(node.id)
    const clones = cloneSources.get(node.componentId)
    if (clones) clones.push(node.id)
    else cloneSources.set(node.componentId, [node.id])
  }
}

export function indexCloneSubtree(
  graph: SceneGraph,
  rootId: string,
  cloneSources: Map<string, string[]>
): void {
  const nodeIds: string[] = []
  const queue = [rootId]
  let index = 0
  while (index < queue.length) {
    const node = graph.getNode(queue[index])
    index++
    if (!node) continue
    nodeIds.push(node.id)
    queue.push(...node.childIds)
  }
  indexCloneNodes(graph, nodeIds, cloneSources)
}

/** Capture clone-source identities by path before a populated branch is replaced. */
export function snapshotChildSources(graph: SceneGraph, parentId: string): ChildSourceSnapshot[] {
  const result: ChildSourceSnapshot[] = []
  const parent = graph.getNode(parentId)
  if (!parent) return result

  const visit = (nodeId: string, path: number[]) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    result.push({ id: node.id, path, type: node.type })
    node.childIds.forEach((childId, index) => visit(childId, [...path, index]))
  }
  parent.childIds.forEach((childId, index) => visit(childId, [index]))
  return result
}

function resolveChildPath(graph: SceneGraph, parentId: string, path: number[]): SceneNode | null {
  let node = graph.getNode(parentId)
  if (!node) return null
  for (const index of path) {
    const childId = node.childIds[index]
    if (!childId) return null
    node = graph.getNode(childId)
    if (!node) return null
  }
  return node
}

function cloneIdsForReplacement(
  graph: SceneGraph,
  previousId: string,
  replacementId: string,
  cloneSources?: Map<string, string[]>
): Set<string> {
  return new Set([
    ...(cloneSources?.get(previousId) ?? []),
    ...(cloneSources?.get(replacementId) ?? []),
    ...(graph.instanceIndex.get(previousId) ?? []),
    ...(graph.instanceIndex.get(replacementId) ?? [])
  ])
}

function indexReplacementClone(
  cloneSources: Map<string, string[]> | undefined,
  replacementId: string,
  cloneId: string
): void {
  if (!cloneSources) return
  const sourceIds = cloneSourceIds(cloneSources)
  let known = sourceIds.get(replacementId)
  if (!known) {
    known = new Set()
    sourceIds.set(replacementId, known)
  }
  if (known.has(cloneId)) return
  known.add(cloneId)

  let replacements = cloneSources.get(replacementId)
  if (!replacements) {
    replacements = []
    cloneSources.set(replacementId, replacements)
  }
  replacements.push(cloneId)
}

/**
 * Redirect descendants that cloned the removed branch to its structural
 * replacements. Without this, deep instances keep componentId references to
 * deleted nodes and miss later text, visibility, and geometry synchronization.
 */
export function remapRepopulatedChildSources(
  graph: SceneGraph,
  parentId: string,
  previousSources: ChildSourceSnapshot[],
  cloneSources?: Map<string, string[]>,
  activeNodeIds?: Set<string>
): void {
  if (cloneSources) refreshCloneSources(graph, cloneSources, activeNodeIds)
  for (const previous of previousSources) {
    const replacement = resolveChildPath(graph, parentId, previous.path)
    if (!replacement || replacement.type !== previous.type) continue
    const cloneIds = cloneIdsForReplacement(graph, previous.id, replacement.id, cloneSources)
    for (const cloneId of cloneIds) {
      const clone = graph.getNode(cloneId)
      if (clone?.componentId !== previous.id && clone?.componentId !== replacement.id) {
        continue
      }
      graph.updateNode(cloneId, cloneInstanceUpdate(replacement, replacement.id))
      indexReplacementClone(cloneSources, replacement.id, cloneId)
    }
  }
}
