import type { SceneGraph, SceneNode } from '../scene-graph'
import { guidToString, convertOverrideToProps } from './kiwi-convert'
import type { GUID } from './codec'

interface SymbolOverride {
  guidPath?: { guids?: GUID[] }
  overriddenSymbolID?: GUID
  [key: string]: unknown
}

interface SymbolData {
  symbolID?: GUID
  symbolOverrides?: SymbolOverride[]
}

interface ComponentPropRef {
  defID: GUID
  componentPropNodeField: string
}

interface ComponentPropAssignment {
  defID: GUID
  value: { boolValue?: boolean; textValue?: string }
}

interface DerivedSymbolOverride {
  guidPath?: { guids?: GUID[] }
  size?: { x: number; y: number }
}

export interface InstanceNodeChange {
  type?: string
  guid?: GUID
  overrideKey?: GUID
  symbolData?: SymbolData
  componentPropRefs?: ComponentPropRef[]
  componentPropAssignments?: ComponentPropAssignment[]
  derivedSymbolData?: DerivedSymbolOverride[]
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
  function getComponentRoot(nodeId: string, depth = 0): string {
    if (componentIdRoot.has(nodeId)) return componentIdRoot.get(nodeId) ?? nodeId
    const node = graph.getNode(nodeId)
    if (!node?.componentId || depth > 20) {
      componentIdRoot.set(nodeId, nodeId)
      return nodeId
    }
    const root = getComponentRoot(node.componentId, depth + 1)
    componentIdRoot.set(nodeId, root)
    return root
  }

  function findNodeByComponentId(parentId: string, componentId: string): string | null {
    const targetRoot = getComponentRoot(componentId)
    const parent = graph.getNode(parentId)
    if (!parent) return null
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      if (child.componentId === componentId) return childId
      if (child.componentId && getComponentRoot(child.componentId) === targetRoot) return childId
      const deep = findNodeByComponentId(childId, componentId)
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

      // The override may target the current node itself (when it's an instance
      // cloned from the component the override points to)
      const current = graph.getNode(currentId)
      if (current?.componentId === remapped) {
        continue
      }

      const found = findNodeByComponentId(currentId, remapped)
      if (!found) return null
      currentId = found
    }
    return currentId
  }

  // Reverse map: graph node ID → figma GUID
  const nodeIdToGuid = new Map<string, string>()
  for (const [figmaId, nodeId] of guidToNodeId) {
    nodeIdToGuid.set(nodeId, figmaId)
  }

  // Apply component property assignments (boolean visibility, instance swap).
  // Component children reference property definitions via componentPropRefs.
  // Instances set values via componentPropAssignments. After cloning, we walk
  // each instance's descendants and apply the assignments.

  function findPropRefs(nodeId: string, propRefsMap: Map<string, ComponentPropRef[]>): ComponentPropRef[] | undefined {
    let sourceId: string | undefined = nodeId
    for (let depth = 0; sourceId && depth < 10; depth++) {
      const figmaId = nodeIdToGuid.get(sourceId)
      if (figmaId) {
        const refs = propRefsMap.get(figmaId)
        if (refs) return refs
      }
      const node = graph.getNode(sourceId)
      const nextId = node?.componentId ?? undefined
      if (nextId === sourceId) break
      sourceId = nextId
    }
    return undefined
  }

  function repopulateInstance(nodeId: string, compId: string) {
    const node = graph.getNode(nodeId)
    if (!node || node.type !== 'INSTANCE') return
    for (const childId of [...node.childIds]) graph.deleteNode(childId)
    graph.updateNode(nodeId, { componentId: compId })
    const comp = graph.getNode(compId)
    if (comp && comp.childIds.length > 0) {
      graph.populateInstanceChildren(nodeId, compId)
    }
    componentIdRoot.clear()
  }

  function applyComponentProperties() {
    const propRefsMap = new Map<string, ComponentPropRef[]>()
    for (const [figmaId, nc] of changeMap) {
      if (nc.componentPropRefs?.length) {
        propRefsMap.set(figmaId, nc.componentPropRefs)
      }
    }
    if (propRefsMap.size === 0) return

    for (const [figmaId, nc] of changeMap) {
      if (!nc.componentPropAssignments?.length) continue

      const instanceNodeId = guidToNodeId.get(figmaId)
      if (!instanceNodeId) continue
      if (graph.getNode(instanceNodeId)?.type !== 'INSTANCE') continue

      const valueByDef = new Map<string, ComponentPropAssignment['value']>()
      for (const a of nc.componentPropAssignments) {
        if (a.defID) valueByDef.set(guidToString(a.defID), a.value)
      }

      applyPropAssignments(instanceNodeId, valueByDef, propRefsMap)
    }
  }

  function applyPropAssignments(
    parentId: string,
    valueByDef: Map<string, ComponentPropAssignment['value']>,
    propRefsMap: Map<string, ComponentPropRef[]>
  ) {
    const parent = graph.getNode(parentId)
    if (!parent) return

    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child?.componentId) {
        applyPropAssignments(childId, valueByDef, propRefsMap)
        continue
      }

      const refs = findPropRefs(child.componentId, propRefsMap)
      if (refs) {
        for (const ref of refs) {
          if (!ref.defID) continue
          const val = valueByDef.get(guidToString(ref.defID))
          if (!val) continue

          if (ref.componentPropNodeField === 'VISIBLE' && val.boolValue !== undefined) {
            graph.updateNode(childId, { visible: val.boolValue })
          } else if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID' && val.textValue) {
            const newCompId = guidToNodeId.get(val.textValue)
            if (newCompId) repopulateInstance(childId, newCompId)
          }
        }
      }

      applyPropAssignments(childId, valueByDef, propRefsMap)
    }
  }

  // Apply derivedSymbolData — pre-computed sizes for the current set of
  // component property values. Uses the same guidPath resolution as
  // symbolOverrides.
  function applyDerivedSymbolData() {
    for (const [ncId, nc] of changeMap) {
      if (nc.type !== 'INSTANCE') continue
      const derived = nc.derivedSymbolData
      if (!derived?.length) continue

      const nodeId = guidToNodeId.get(ncId)
      if (!nodeId) continue

      for (const d of derived) {
        const guids = d.guidPath?.guids
        if (!guids?.length) continue
        if (!d.size) continue

        const targetId = resolveOverrideTarget(nodeId, guids)
        if (!targetId) continue

        graph.updateNode(targetId, { width: d.size.x, height: d.size.y })
      }
    }
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

        if (ov.overriddenSymbolID) {
          const newCompId = guidToNodeId.get(guidToString(ov.overriddenSymbolID))
          if (newCompId) repopulateInstance(targetId, newCompId)
        }

        const { guidPath: _, overriddenSymbolID: _s, ...fields } = ov
        if (Object.keys(fields).length === 0) continue

        const updates = convertOverrideToProps(fields as Record<string, unknown>)
        if (Object.keys(updates).length > 0) {
          graph.updateNode(targetId, updates)
        }
      }
    }
  }

  // Order matters: symbolOverrides set property values, componentProperties
  // toggle visibility/swap instances, derivedSymbolData applies Figma's
  // pre-computed sizes for the resulting configuration.
  applySymbolOverrides()
  applyComponentProperties()
  applyDerivedSymbolData()

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
        repopulateInstance(node.id, node.componentId)
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
