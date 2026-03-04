import type { SceneGraph, SceneNode } from '../scene-graph'
import { guidToString, convertOverrideToProps } from './kiwi-convert'
import type { GUID } from './codec'

interface SymbolOverride {
  guidPath?: { guids?: GUID[] }
  [key: string]: unknown
}

interface SymbolData {
  symbolID?: GUID
  symbolOverrides?: SymbolOverride[]
}

export interface InstanceNodeChange {
  type?: string
  guid?: GUID
  overrideKey?: GUID
  symbolData?: SymbolData
}

/**
 * Populate empty instances from their components and apply symbol overrides.
 *
 * Shared between .fig file import and clipboard paste. Both paths produce
 * a SceneGraph with INSTANCE nodes whose componentId references have been
 * remapped to graph node IDs but whose children may be missing and whose
 * overrides have not yet been applied.
 *
 * @param graph       – the SceneGraph (mutated in place)
 * @param changeMap   – figmaGuid → raw kiwi node change (for overrideKey + symbolData)
 * @param guidToNodeId – figmaGuid → graph node ID
 */
export function populateAndApplyOverrides(
  graph: SceneGraph,
  changeMap: Map<string, InstanceNodeChange>,
  guidToNodeId: Map<string, string>
): void {
  // Iterative population: cloning creates new instances that themselves need children
  let populated = 1
  while (populated > 0) {
    populated = 0
    for (const node of graph.getAllNodes()) {
      if (node.type !== 'INSTANCE' || !node.componentId || node.childIds.length > 0) continue
      const comp = graph.getNode(node.componentId)
      if (comp && comp.childIds.length > 0) {
        graph.populateInstanceChildren(node.id, node.componentId)
        populated++
      }
    }
  }

  // Build overrideKey → figmaGuid map
  const overrideKeyToGuid = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (nc.overrideKey) overrideKeyToGuid.set(guidToString(nc.overrideKey), id)
  }

  // Component root resolution (walks componentId chain to the ultimate source)
  const componentIdRoot = new Map<string, string>()
  function getComponentRoot(nodeId: string): string {
    if (componentIdRoot.has(nodeId)) return componentIdRoot.get(nodeId) ?? nodeId
    const node = graph.getNode(nodeId)
    if (!node?.componentId) {
      componentIdRoot.set(nodeId, nodeId)
      return nodeId
    }
    const root = getComponentRoot(node.componentId)
    componentIdRoot.set(nodeId, root)
    return root
  }

  function findDescendantByComponentId(parentId: string, componentId: string): string | null {
    const targetRoot = getComponentRoot(componentId)
    const parent = graph.getNode(parentId)
    if (!parent) return null
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      if (child.componentId && getComponentRoot(child.componentId) === targetRoot) return childId
      const deep = findDescendantByComponentId(childId, componentId)
      if (deep) return deep
    }
    return null
  }

  function resolveOverrideTarget(instanceId: string, guids: GUID[]): string | null {
    let currentId = instanceId
    for (const guid of guids) {
      const key = guidToString(guid)
      const figmaGuid = overrideKeyToGuid.get(key) ?? key
      const remapped = guidToNodeId.get(figmaGuid)
      if (!remapped) return null
      const found = findDescendantByComponentId(currentId, remapped)
      if (!found) return null
      currentId = found
    }
    return currentId
  }

  // Apply overrides from each INSTANCE's symbolData
  const overriddenNodes = new Set<string>()

  function applySymbolOverrides() {
    componentIdRoot.clear()

    for (const [ncId, nc] of changeMap) {
      if (nc.type !== 'INSTANCE') continue
      const sd = nc.symbolData
      if (!sd?.symbolOverrides?.length) continue

      const nodeId = guidToNodeId.get(ncId)
      if (!nodeId) continue

      for (const ov of sd.symbolOverrides) {
        const guids = ov.guidPath?.guids
        if (!guids?.length) continue

        const targetId = resolveOverrideTarget(nodeId, guids)
        if (!targetId) continue

        overriddenNodes.add(targetId)

        // Instance swap
        const swapGuid = (ov as Record<string, unknown>).overriddenSymbolID as GUID | undefined
        if (swapGuid) {
          const swapFigmaId = guidToString(swapGuid)
          const newCompId = guidToNodeId.get(swapFigmaId)
          const target = graph.getNode(targetId)
          if (newCompId && target?.type === 'INSTANCE') {
            for (const childId of [...target.childIds]) graph.deleteNode(childId)
            graph.updateNode(targetId, { componentId: newCompId })
            const newComp = graph.getNode(newCompId)
            if (newComp && newComp.childIds.length > 0) {
              graph.populateInstanceChildren(targetId, newCompId)
            }
            componentIdRoot.clear()
          }
        }

        const { guidPath: _, overriddenSymbolID: _s, ...fields } = ov as Record<string, unknown>
        if (Object.keys(fields).length === 0) continue

        const updates = convertOverrideToProps(fields as Record<string, unknown>)
        if (Object.keys(updates).length > 0) {
          graph.updateNode(targetId, updates)
        }
      }
    }
  }

  applySymbolOverrides()

  if (overriddenNodes.size === 0) return

  // Propagate overrides transitively through the clone chain
  const clonesOf = new Map<string, string[]>()
  for (const node of graph.getAllNodes()) {
    if (!node.componentId) continue
    let arr = clonesOf.get(node.componentId)
    if (!arr) {
      arr = []
      clonesOf.set(node.componentId, arr)
    }
    arr.push(node.id)
  }

  const needsSync = new Set<string>()
  const queue = [...overriddenNodes]
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    const clones = clonesOf.get(id)
    if (!clones) continue
    for (const cloneId of clones) {
      if (needsSync.has(cloneId)) continue
      needsSync.add(cloneId)
      queue.push(cloneId)
    }
  }

  const visited = new Set<string>()
  const syncQueue = [...overriddenNodes]
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

      if (node.type === 'INSTANCE' && source.type === 'INSTANCE' && node.componentId) {
        for (const childId of [...node.childIds]) graph.deleteNode(childId)
        graph.populateInstanceChildren(node.id, node.componentId)
      } else {
        const updates: Partial<SceneNode> = {}
        if (source.text !== node.text) updates.text = source.text
        if (source.visible !== node.visible) updates.visible = source.visible
        if (source.opacity !== node.opacity) updates.opacity = source.opacity
        if (source.name !== node.name) updates.name = source.name
        if (source.fills !== node.fills) updates.fills = structuredClone(source.fills)
        if (source.strokes !== node.strokes) updates.strokes = structuredClone(source.strokes)
        if (source.effects !== node.effects) updates.effects = structuredClone(source.effects)
        if (source.styleRuns !== node.styleRuns) updates.styleRuns = structuredClone(source.styleRuns)
        if (source.layoutGrow !== node.layoutGrow) updates.layoutGrow = source.layoutGrow
        if (source.textAutoResize !== node.textAutoResize) updates.textAutoResize = source.textAutoResize
        if (source.locked !== node.locked) updates.locked = source.locked
        if (Object.keys(updates).length > 0) graph.updateNode(node.id, updates)
      }

      syncQueue.push(cloneId)
    }
  }
}
