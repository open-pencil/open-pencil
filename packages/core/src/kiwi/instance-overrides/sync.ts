import type { SceneGraph, SceneNode } from '#core/scene-graph'
import { copyFills, copyStrokes, copyEffects, copyStyleRuns } from '#core/scene-graph/copy'

/**
 * Copy appearance props from source to target (text, visibility, fills, etc.).
 * Only writes properties that actually differ.
 */
export function syncNodeProps(graph: SceneGraph, source: SceneNode, target: SceneNode): void {
  const updates: Partial<SceneNode> = {}
  if (source.text !== target.text) updates.text = source.text
  if (source.visible !== target.visible) updates.visible = source.visible
  if (source.opacity !== target.opacity) updates.opacity = source.opacity
  if (source.fills !== target.fills) updates.fills = copyFills(source.fills)
  if (source.strokes !== target.strokes) updates.strokes = copyStrokes(source.strokes)
  if (source.effects !== target.effects) updates.effects = copyEffects(source.effects)
  if (source.styleRuns !== target.styleRuns) updates.styleRuns = copyStyleRuns(source.styleRuns)
  if (source.layoutGrow !== target.layoutGrow) updates.layoutGrow = source.layoutGrow
  if (source.textAutoResize !== target.textAutoResize)
    updates.textAutoResize = source.textAutoResize
  if (source.locked !== target.locked) updates.locked = source.locked
  if (Object.keys(updates).length > 0) graph.updateNode(target.id, updates)
}

/**
 * Re-clone an instance's children from a new source (after instance swap).
 * Marks the target in `swappedInstances` so transitive sync propagates the swap.
 */
export function recloneChildren(
  graph: SceneGraph,
  srcChildId: string,
  tgtNode: SceneNode,
  swappedInstances: Set<string>
): void {
  const srcChild = graph.getNode(srcChildId)
  if (!srcChild) return

  for (const childId of Array.from(tgtNode.childIds)) graph.deleteNode(childId)
  graph.updateNode(tgtNode.id, { name: srcChild.name, componentId: srcChild.componentId })
  syncNodeProps(graph, srcChild, tgtNode)
  if (srcChild.childIds.length > 0) {
    graph.populateInstanceChildren(tgtNode.id, srcChildId)
  }
  swappedInstances.add(tgtNode.id)
}

/**
 * Recursively sync children between source and target trees.
 * Handles instance swap propagation via `swappedInstances`.
 */
export function syncChildrenDeep(
  graph: SceneGraph,
  sourceId: string,
  targetId: string,
  swappedInstances: Set<string>,
  skip?: Set<string>
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

    if (
      srcNode.type === 'INSTANCE' &&
      swappedInstances.has(src.childIds[i]) &&
      srcNode.componentId !== tgtNode.componentId
    ) {
      recloneChildren(graph, src.childIds[i], tgtNode, swappedInstances)
      continue
    }

    syncNodeProps(graph, srcNode, tgtNode)
    syncChildrenDeep(graph, src.childIds[i], tgt.childIds[i], swappedInstances, skip)
  }
}

/** Build a map of componentId → list of clone node IDs. */
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

/** Expand seeds to include INSTANCE/COMPONENT parents up the tree. */
function expandSeedsToParents(graph: SceneGraph, seeds: Set<string>): Set<string> {
  const expanded = new Set(seeds)
  for (const seedId of seeds) {
    let cur = graph.getNode(seedId)
    while (cur?.parentId) {
      const parent = graph.getNode(cur.parentId)
      if (!parent) break
      if (parent.type === 'INSTANCE' || parent.type === 'COMPONENT') {
        expanded.add(parent.id)
      }
      cur = parent
    }
  }
  return expanded
}

/** BFS from expanded seeds through clone chains to find all nodes needing sync. */
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

/**
 * Propagate overrides transitively through clone chains.
 *
 * Nodes in `seeds` are override sources — their clones are synced but
 * the seeds themselves are NOT overwritten (they carry explicit overrides).
 */
export function propagateOverridesTransitively(
  graph: SceneGraph,
  seeds: Set<string>,
  swappedInstances: Set<string>,
  componentIdRoot: Map<string, string>,
  protect?: Set<string>,
  activeNodeIds?: Set<string>
): void {
  if (seeds.size === 0) return

  componentIdRoot.clear()
  const clonesOf = buildClonesMap(graph, activeNodeIds)
  const expandedSeeds = expandSeedsToParents(graph, seeds)
  const needsSync = buildNeedsSyncSet(expandedSeeds, clonesOf)

  // Merge seeds + protect into a single skip set for syncChildrenDeep
  const skip = protect && protect.size > 0 ? new Set([...seeds, ...protect]) : seeds

  const visited = new Set<string>()
  const syncQueue = [...expandedSeeds]
  for (let sourceId = syncQueue.shift(); sourceId !== undefined; sourceId = syncQueue.shift()) {
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

      syncNodeProps(graph, source, node)
      if (source.childIds.length !== node.childIds.length) {
        for (const childId of Array.from(node.childIds)) graph.deleteNode(childId)
        if (source.childIds.length > 0) {
          graph.populateInstanceChildren(node.id, sourceId)
        }
      } else if (source.childIds.length > 0 && node.childIds.length > 0) {
        syncChildrenDeep(graph, sourceId, node.id, swappedInstances, skip)
      }
      syncQueue.push(cloneId)
    }
  }
}
