import { guidToString } from '#core/kiwi/node-change/convert'

import type { GUID } from '#core/kiwi/binary/codec'
import type { SceneNode } from '#core/scene-graph'
import type { InstanceNodeChange, OverrideContext } from './types'

const MAX_CHAIN_DEPTH = 20
const siblingIndexCache = new WeakMap<OverrideContext, Map<string, number | null>>()
const siblingGroupCache = new WeakMap<OverrideContext, Map<string, string[]>>()
const candidateCache = new WeakMap<OverrideContext, Map<string, string[]>>()
const componentFindCache = new WeakMap<OverrideContext, Map<string, string | null>>()

/**
 * Pre-compute componentId root for every node.
 *
 * Must run while all internal-page nodes are still alive. After overrides,
 * instance swaps delete intermediate clones, breaking the chain.
 * DSD resolution uses this to match across clone levels.
 */
export function preComputeRoots(ctx: OverrideContext): void {
  function resolve(nodeId: string, depth = 0): string {
    const cached = ctx.preComputedRoot.get(nodeId)
    if (cached !== undefined) return cached
    if (depth > MAX_CHAIN_DEPTH) return nodeId

    const node = ctx.graph.getNode(nodeId)
    if (node?.componentId && node.componentId !== nodeId) {
      const root = resolve(node.componentId, depth + 1)
      ctx.preComputedRoot.set(nodeId, root)
      return root
    }
    ctx.preComputedRoot.set(nodeId, nodeId)
    return nodeId
  }

  for (const node of ctx.graph.getAllNodes()) {
    if (node.componentId) resolve(node.id)
  }
}

/**
 * Walk the componentId chain to the ultimate source COMPONENT.
 * Falls back to kiwi symbolData for deleted internal-page nodes.
 */
export function getComponentRoot(ctx: OverrideContext, nodeId: string, depth = 0): string {
  const cached = ctx.componentIdRoot.get(nodeId)
  if (cached !== undefined) return cached
  if (depth > MAX_CHAIN_DEPTH) {
    ctx.componentIdRoot.set(nodeId, nodeId)
    return nodeId
  }

  const node = ctx.graph.getNode(nodeId)
  if (node?.componentId) {
    const root = getComponentRoot(ctx, node.componentId, depth + 1)
    ctx.componentIdRoot.set(nodeId, root)
    return root
  }

  // For deleted nodes (internal page), resolve via kiwi symbolData
  const figmaId = ctx.nodeIdToGuid.get(nodeId)
  if (figmaId) {
    const nc = ctx.changeMap.get(figmaId)
    const symId = nc?.symbolData?.symbolID
    if (symId) {
      const compNodeId = ctx.guidToNodeId.get(guidToString(symId))
      if (compNodeId && compNodeId !== nodeId) {
        const root = getComponentRoot(ctx, compNodeId, depth + 1)
        ctx.componentIdRoot.set(nodeId, root)
        return root
      }
    }
  }

  ctx.componentIdRoot.set(nodeId, nodeId)
  return nodeId
}

/**
 * Find a descendant whose componentId matches, walking recursively.
 *
 * Pass 1: exact componentId on direct children.
 * Pass 2: root match — only if exactly one child shares the root (avoids
 *         ambiguity when multiple siblings share the same root).
 * Pass 3: recurse into children.
 */
function buildSiblingGroups(ctx: OverrideContext): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const [id, sibling] of ctx.changeMap) {
    const siblingParent = sibling.parentIndex?.guid ? guidToString(sibling.parentIndex.guid) : null
    const siblingSymbol = sibling.symbolData?.symbolID
      ? guidToString(sibling.symbolData.symbolID)
      : null
    if (!siblingParent || !siblingSymbol) continue
    const groupKey = `${siblingParent}\0${siblingSymbol}`
    const group = groups.get(groupKey)
    if (group) group.push(id)
    else groups.set(groupKey, [id])
  }
  for (const group of groups.values()) {
    group.sort((aId, bId) => {
      const a = ctx.changeMap.get(aId)
      const b = ctx.changeMap.get(bId)
      return (
        (a?.transform?.m12 ?? 0) - (b?.transform?.m12 ?? 0) ||
        (a?.transform?.m02 ?? 0) - (b?.transform?.m02 ?? 0)
      )
    })
  }
  return groups
}

function getSiblingGroups(ctx: OverrideContext): Map<string, string[]> {
  const cached = siblingGroupCache.get(ctx)
  if (cached) return cached
  const groups = buildSiblingGroups(ctx)
  siblingGroupCache.set(ctx, groups)
  return groups
}

function sourceSiblingIndex(ctx: OverrideContext, figmaGuid: string): number | null {
  let cache = siblingIndexCache.get(ctx)
  if (!cache) {
    cache = new Map()
    siblingIndexCache.set(ctx, cache)
  }
  if (cache.has(figmaGuid)) return cache.get(figmaGuid) ?? null

  const nc = ctx.changeMap.get(figmaGuid)
  const parentId = nc?.parentIndex?.guid ? guidToString(nc.parentIndex.guid) : null
  const symbolId = nc?.symbolData?.symbolID ? guidToString(nc.symbolData.symbolID) : null
  if (!nc || !parentId || !symbolId) {
    cache.set(figmaGuid, null)
    return null
  }

  const siblings = getSiblingGroups(ctx).get(`${parentId}\0${symbolId}`) ?? []
  const index = siblings.indexOf(figmaGuid)
  const result = index !== -1 ? index : null
  cache.set(figmaGuid, result)
  return result
}

function findNodeByNameAndType(
  ctx: OverrideContext,
  parentId: string,
  name: string | undefined,
  type: string | undefined
): string | null {
  if (!name || !type) return null
  let match: string | null = null
  let count = 0
  const visit = (id: string) => {
    if (count > 1) return
    const node = ctx.graph.getNode(id)
    if (!node) return
    if (node.name === name && node.type === type) {
      count++
      match = id
    }
    for (const childId of node.childIds) visit(childId)
  }
  visit(parentId)
  return count === 1 ? match : null
}

function findNodeBySourceSiblingIndex(
  ctx: OverrideContext,
  parentId: string,
  componentId: string,
  figmaGuid: string
): string | null {
  const index = sourceSiblingIndex(ctx, figmaGuid)
  if (index == null) return null

  const targetRoot = ctx.preComputedRoot.get(componentId) ?? getComponentRoot(ctx, componentId)
  let cache = candidateCache.get(ctx)
  if (!cache) {
    cache = new Map()
    candidateCache.set(ctx, cache)
  }
  const cacheKey = `${parentId}\0${targetRoot}`
  let candidates = cache.get(cacheKey)
  if (!candidates) {
    candidates = []
    const collect = (id: string) => {
      const node = ctx.graph.getNode(id)
      if (!node) return
      if (node.componentId) {
        const root =
          ctx.preComputedRoot.get(node.componentId) ?? getComponentRoot(ctx, node.componentId)
        if (root === targetRoot) candidates?.push(id)
      }
      for (const childId of node.childIds) collect(childId)
    }
    collect(parentId)
    candidates.sort((aId, bId) => {
      const a = ctx.graph.getNode(aId)
      const b = ctx.graph.getNode(bId)
      return (a?.y ?? 0) - (b?.y ?? 0) || (a?.x ?? 0) - (b?.x ?? 0)
    })
    cache.set(cacheKey, candidates)
  }
  return candidates[index] ?? null
}

export function findNodeByComponentId(
  ctx: OverrideContext,
  parentId: string,
  componentId: string
): string | null {
  let cache = componentFindCache.get(ctx)
  if (!cache) {
    cache = new Map()
    componentFindCache.set(ctx, cache)
  }
  const cacheKey = `${parentId}\0${componentId}`
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null

  const parent = ctx.graph.getNode(parentId)
  if (!parent) return null

  for (const childId of parent.childIds) {
    const child = ctx.graph.getNode(childId)
    if (child?.componentId === componentId) {
      cache.set(cacheKey, childId)
      return childId
    }
  }

  const targetRoot = ctx.preComputedRoot.get(componentId) ?? getComponentRoot(ctx, componentId)
  if (targetRoot) {
    let rootMatch: string | null = null
    let ambiguous = false
    for (const childId of parent.childIds) {
      const child = ctx.graph.getNode(childId)
      if (!child?.componentId) continue
      const childRoot =
        ctx.preComputedRoot.get(child.componentId) ?? getComponentRoot(ctx, child.componentId)
      if (childRoot === targetRoot) {
        if (rootMatch) {
          ambiguous = true
          break
        }
        rootMatch = childId
      }
    }
    if (rootMatch && !ambiguous) {
      cache.set(cacheKey, rootMatch)
      return rootMatch
    }
  }

  for (const childId of parent.childIds) {
    const deep = findNodeByComponentId(ctx, childId, componentId)
    if (deep) {
      cache.set(cacheKey, deep)
      return deep
    }
  }
  return null
}

/**
 * Resolve a guidPath to a target node within an instance subtree.
 *
 * Each GUID in the path identifies an overrideKey → figmaGuid → graph node.
 * The chain walks from the instance down to the target.
 */
function resolveOverrideStep(
  ctx: OverrideContext,
  currentId: string,
  figmaGuid: string,
  remapped: string | undefined,
  targetNc: InstanceNodeChange | undefined
): string | null {
  if (!remapped) return findNodeByNameAndType(ctx, currentId, targetNc?.name, targetNc?.type)

  const current = ctx.graph.getNode(currentId)
  if (current?.componentId === remapped) return currentId

  return (
    findNodeByComponentId(ctx, currentId, remapped) ??
    findNodeBySourceSiblingIndex(ctx, currentId, remapped, figmaGuid) ??
    findNodeByNameAndType(ctx, currentId, targetNc?.name, targetNc?.type)
  )
}

export function resolveOverrideTarget(
  ctx: OverrideContext,
  instanceId: string,
  guids: GUID[]
): string | null {
  let currentId = instanceId
  for (let index = 0; index < guids.length; index++) {
    const key = guidToString(guids[index])
    const figmaGuid = ctx.overrideKeyToGuid.get(key) ?? key
    const targetNc = ctx.changeMap.get(figmaGuid)
    const symbolGuid = targetNc?.symbolData?.symbolID
      ? guidToString(targetNc.symbolData.symbolID)
      : null
    const remapped =
      ctx.guidToNodeId.get(figmaGuid) ?? (symbolGuid ? ctx.guidToNodeId.get(symbolGuid) : undefined)
    const resolved = resolveOverrideStep(ctx, currentId, figmaGuid, remapped, targetNc)
    if (resolved) {
      currentId = resolved
      continue
    }

    const parent = ctx.graph.getNode(currentId)
    if (parent?.childIds.length === 1) {
      currentId = parent.childIds[0]
      index--
      continue
    }

    return null
  }
  return currentId
}

/**
 * Repopulate an INSTANCE node with children from a new component (instance swap).
 * Only renames when the current name matches the root component name (preserves
 * user-given names). Clears the componentIdRoot cache after changing the tree.
 */
export function repopulateInstance(ctx: OverrideContext, nodeId: string, compId: string): void {
  const node = ctx.graph.getNode(nodeId)
  if (node?.type !== 'INSTANCE') return

  const rootCompId = node.componentId ? getComponentRoot(ctx, node.componentId) : undefined
  const rootComp = rootCompId ? ctx.graph.getNode(rootCompId) : undefined
  for (const childId of Array.from(node.childIds)) ctx.graph.deleteNode(childId)
  const comp = ctx.graph.getNode(compId)
  const updates: Partial<SceneNode> = { componentId: compId }
  if (comp?.name && rootComp?.name && node.name === rootComp.name) {
    updates.name = comp.name
  }
  ctx.graph.updateNode(nodeId, updates)
  if (comp && comp.childIds.length > 0) {
    ctx.graph.populateInstanceChildren(nodeId, compId)
  }
  ctx.componentIdRoot.clear()
  candidateCache.delete(ctx)
  componentFindCache.delete(ctx)
}
