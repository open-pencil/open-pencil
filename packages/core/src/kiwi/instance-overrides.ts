import type { SceneGraph, SceneNode, GeometryPath } from '../scene-graph'
import { guidToString, convertOverrideToProps, resolveGeometryPaths } from './kiwi-convert'
import { copyFills, copyStrokes, copyEffects, copyStyleRuns, copyGeometryPaths } from '../copy'
import { profileStage, profileStart } from './fig-parse-profile'
import type { GUID } from './codec'
import type { Matrix, Vector } from '../types'

interface SymbolOverride {
  guidPath?: { guids?: GUID[] }
  overriddenSymbolID?: GUID
  componentPropAssignments?: ComponentPropAssignment[]
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
  value: { boolValue?: boolean; textValue?: string; guidValue?: GUID }
}

interface DerivedSymbolOverride {
  guidPath?: { guids?: GUID[] }
  size?: Vector
  transform?: Matrix
  fillGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
  strokeGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
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
  guidToNodeId: Map<string, string>,
  blobs: Uint8Array[] = []
): void {
  // Work-queue population: seed with empty instances, then discover newly
  // cloned nested instances by walking the subtree (avoids full graph scan per round).
  const populateQueue: string[] = []
  for (const node of graph.getAllNodes()) {
    if (node.type === 'INSTANCE' && node.componentId && node.childIds.length === 0) {
      populateQueue.push(node.id)
    }
  }

  function collectEmptyInstances(parentId: string, out: string[]) {
    const parent = graph.getNode(parentId)
    if (!parent) return
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      if (child.type === 'INSTANCE' && child.componentId && child.childIds.length === 0) {
        out.push(child.id)
      } else if (child.childIds.length > 0) {
        collectEmptyInstances(childId, out)
      }
    }
  }

  while (populateQueue.length > 0) {
    const nodeId = populateQueue.pop()!
    const node = graph.getNode(nodeId)
    if (node?.type !== 'INSTANCE' || !node.componentId || node.childIds.length > 0) continue
    const comp = graph.getNode(node.componentId)
    if (comp && comp.childIds.length > 0) {
      graph.populateInstanceChildren(nodeId, node.componentId)
      collectEmptyInstances(nodeId, populateQueue)
    }
  }

  // Build overrideKey → figmaGuid map
  const overrideKeyToGuid = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (nc.overrideKey) overrideKeyToGuid.set(guidToString(nc.overrideKey), id)
  }

  // Reverse map: graph node ID → figma GUID (used by getComponentRoot kiwi fallback)
  const nodeIdToGuid = new Map<string, string>()
  for (const [figmaId, nodeId] of guidToNodeId) {
    nodeIdToGuid.set(nodeId, figmaId)
  }

  // Pre-compute componentId root for every node while all internal page nodes
  // are still alive. After overrides, instance swaps delete intermediate clones,
  // breaking the chain. DSD resolution uses this to match across clone levels.
  const preComputedRoot = new Map<string, string>()
  function getPreComputedRoot(nodeId: string, depth = 0): string {
    if (preComputedRoot.has(nodeId)) return preComputedRoot.get(nodeId) ?? nodeId
    if (depth > 20) return nodeId
    const node = graph.getNode(nodeId)
    if (node?.componentId && node.componentId !== nodeId) {
      const root = getPreComputedRoot(node.componentId, depth + 1)
      preComputedRoot.set(nodeId, root)
      return root
    }
    preComputedRoot.set(nodeId, nodeId)
    return nodeId
  }
  for (const node of graph.getAllNodes()) {
    if (node.componentId) getPreComputedRoot(node.id)
  }

  // Component root resolution (walks componentId chain to the ultimate source)
  const componentIdRoot = new Map<string, string>()
  function getComponentRoot(nodeId: string, depth = 0): string {
    if (componentIdRoot.has(nodeId)) return componentIdRoot.get(nodeId) ?? nodeId
    if (depth > 20) {
      componentIdRoot.set(nodeId, nodeId)
      return nodeId
    }

    // Try graph first
    const node = graph.getNode(nodeId)
    if (node?.componentId) {
      const root = getComponentRoot(node.componentId, depth + 1)
      componentIdRoot.set(nodeId, root)
      return root
    }

    // For deleted nodes (internal page), resolve via kiwi symbolData
    const figmaId = nodeIdToGuid.get(nodeId)
    if (figmaId) {
      const nc = changeMap.get(figmaId)
      const symId = nc?.symbolData?.symbolID
      if (symId) {
        const compNodeId = guidToNodeId.get(guidToString(symId))
        if (compNodeId && compNodeId !== nodeId) {
          const root = getComponentRoot(compNodeId, depth + 1)
          componentIdRoot.set(nodeId, root)
          return root
        }
      }
    }

    componentIdRoot.set(nodeId, nodeId)
    return nodeId
  }

  function findNodeByComponentId(parentId: string, componentId: string): string | null {
    const parent = graph.getNode(parentId)
    if (!parent) return null

    // Pass 1: exact componentId match on direct children
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (child?.componentId === componentId) return childId
    }

    // Pass 2: root match — but only if exactly one child shares the root
    // (multiple siblings with the same root are ambiguous)
    const targetRoot = preComputedRoot.get(componentId) ?? getComponentRoot(componentId)
    if (targetRoot) {
      let rootMatch: string | null = null
      let ambiguous = false
      for (const childId of parent.childIds) {
        const child = graph.getNode(childId)
        if (!child?.componentId) continue
        const childRoot = preComputedRoot.get(child.componentId) ?? getComponentRoot(child.componentId)
        if (childRoot === targetRoot) {
          if (rootMatch) { ambiguous = true; break }
          rootMatch = childId
        }
      }
      if (rootMatch && !ambiguous) return rootMatch
    }

    // Pass 3: recurse into children
    for (const childId of parent.childIds) {
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
    if (node?.type !== 'INSTANCE') return

    for (const childId of [...node.childIds]) graph.deleteNode(childId)
    graph.updateNode(nodeId, { componentId: compId })
    const comp = graph.getNode(compId)
    if (comp && comp.childIds.length > 0) {
      graph.populateInstanceChildren(nodeId, compId)
    }
    componentIdRoot.clear()
  }

  function assignmentsToValueMap(assignments: ComponentPropAssignment[]): Map<string, ComponentPropAssignment['value']> {
    const valueByDef = new Map<string, ComponentPropAssignment['value']>()
    for (const a of assignments) {
      valueByDef.set(guidToString(a.defID), a.value)
    }
    return valueByDef
  }

  function applyInstanceDirectAssignments(
    assignmentSources: Map<string, ComponentPropAssignment[]>,
    propRefsMap: Map<string, ComponentPropRef[]>
  ) {
    for (const node of graph.getAllNodes()) {
      if (node.type !== 'INSTANCE') continue
      // Apply assignments from the instance's own kiwi data first
      const ownFigmaId = nodeIdToGuid.get(node.id)
      if (ownFigmaId) {
        const ownAssignments = assignmentSources.get(ownFigmaId)
        if (ownAssignments) {
          applyPropAssignments(node.id, assignmentsToValueMap(ownAssignments), propRefsMap)
        }
      }

      // Also apply from cloned instance sources — after population, cloned
      // instances have componentId pointing to the original kiwi node
      if (!node.componentId) continue
      const sourceFigmaId = nodeIdToGuid.get(node.componentId)
      if (!sourceFigmaId) continue
      const assignments = assignmentSources.get(sourceFigmaId)
      if (!assignments) continue

      applyPropAssignments(node.id, assignmentsToValueMap(assignments), propRefsMap)
    }
  }

  function applySymbolOverrideAssignments(propRefsMap: Map<string, ComponentPropRef[]>) {
    for (const [figmaId, nc] of changeMap) {
      const instanceNodeId = guidToNodeId.get(figmaId)
      if (!instanceNodeId) continue
      if (graph.getNode(instanceNodeId)?.type !== 'INSTANCE') continue

      const overrides = nc.symbolData?.symbolOverrides
      if (!overrides) continue
      for (const ov of overrides) {
        if (!ov.componentPropAssignments?.length) continue

        const guids = ov.guidPath?.guids
        if (!guids?.length) continue

        const targetId = resolveOverrideTarget(instanceNodeId, guids)
        if (!targetId) continue

        applyPropAssignments(targetId, assignmentsToValueMap(ov.componentPropAssignments), propRefsMap)
      }
    }
  }

  function applyComponentProperties() {
    const propRefsMap = new Map<string, ComponentPropRef[]>()
    for (const [figmaId, nc] of changeMap) {
      if (nc.componentPropRefs?.length) {
        propRefsMap.set(figmaId, nc.componentPropRefs)
      }
    }
    if (propRefsMap.size === 0) return

    const assignmentSources = new Map<string, ComponentPropAssignment[]>()
    for (const [figmaId, nc] of changeMap) {
      if (nc.componentPropAssignments?.length) {
        assignmentSources.set(figmaId, nc.componentPropAssignments)
      }
    }

    applyInstanceDirectAssignments(assignmentSources, propRefsMap)
    applySymbolOverrideAssignments(propRefsMap)
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
          const val = valueByDef.get(guidToString(ref.defID))
          if (!val) continue

          if (ref.componentPropNodeField === 'VISIBLE' && val.boolValue !== undefined) {
            graph.updateNode(childId, { visible: val.boolValue })
          } else if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID') {
            const swapId = val.textValue ?? (val.guidValue ? guidToString(val.guidValue) : undefined)
            if (!swapId) continue
            const newCompId = guidToNodeId.get(swapId)
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
  function scaleGeometryBlobs(geom: GeometryPath[], sx: number, sy: number): GeometryPath[] {
    if (sx === 1 && sy === 1) return geom
    return geom.map((g) => {
      const src = g.commandsBlob
      const scaled = new Uint8Array(src.length)
      scaled.set(src)
      const dv = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength)
      let o = 0
      while (o < scaled.length) {
        const cmd = scaled[o++]
        if (cmd === 0) continue
        const coords = cmd === 1 || cmd === 2 ? 1 : (cmd === 4 ? 3 : -1)
        if (coords < 0) {
          console.warn(`scaleGeometryBlobs: unknown path command ${cmd} at offset ${o - 1}`)
          break
        }
        for (let i = 0; i < coords; i++) {
          dv.setFloat32(o, dv.getFloat32(o, true) * sx, true)
          dv.setFloat32(o + 4, dv.getFloat32(o + 4, true) * sy, true)
          o += 8
        }
      }
      return { windingRule: g.windingRule, commandsBlob: scaled }
    })
  }

  function resolveDsdGeometry(
    d: DerivedSymbolOverride,
    target: SceneNode
  ): Pick<Partial<SceneNode>, 'fillGeometry' | 'strokeGeometry'> {
    const result: Pick<Partial<SceneNode>, 'fillGeometry' | 'strokeGeometry'> = {}
    const fg = resolveGeometryPaths(d.fillGeometry, blobs)
    const sg = resolveGeometryPaths(d.strokeGeometry, blobs)
    if (fg.length > 0) {
      result.fillGeometry = fg
    } else if (d.size && target.fillGeometry.length > 0 && target.width > 0 && target.height > 0) {
      result.fillGeometry = scaleGeometryBlobs(target.fillGeometry, d.size.x / target.width, d.size.y / target.height)
    }
    if (sg.length > 0) {
      result.strokeGeometry = sg
    } else if (d.size && target.strokeGeometry.length > 0 && target.width > 0 && target.height > 0) {
      result.strokeGeometry = scaleGeometryBlobs(target.strokeGeometry, d.size.x / target.width, d.size.y / target.height)
    }
    return result
  }

  function resolveDsdUpdates(): { dsdModified: Set<string>; dsdSizeSet: Set<string> } {
    const dsdModified = new Set<string>()
    const dsdSizeSet = new Set<string>()

    for (const [ncId, nc] of changeMap) {
      if (nc.type !== 'INSTANCE') continue
      const derived = nc.derivedSymbolData
      if (!derived?.length) continue

      const nodeId = guidToNodeId.get(ncId)
      if (!nodeId) continue

      for (const d of derived) {
        const guids = d.guidPath?.guids
        if (!guids?.length) continue

        const targetId = resolveOverrideTarget(nodeId, guids)
        if (!targetId) continue

        const target = graph.getNode(targetId)
        if (!target) continue

        const updates: Partial<SceneNode> = {}
        if (d.size) {
          updates.width = d.size.x
          updates.height = d.size.y
        }
        if (d.transform) {
          updates.x = d.transform.m02
          updates.y = d.transform.m12
        }
        Object.assign(updates, resolveDsdGeometry(d, target))

        if (Object.keys(updates).length > 0) {
          graph.updateNode(targetId, updates)
          dsdModified.add(targetId)
          if (d.size) dsdSizeSet.add(targetId)
        }
      }
    }

    return { dsdModified, dsdSizeSet }
  }

  // Propagate DSD changes through clone chains — each clone should match
  // its source for size/position/geometry. Nodes whose size was explicitly
  // set by DSD keep their own values; others inherit from their source.
  function propagateDsdChanges(dsdModified: Set<string>, dsdSizeSet: Set<string>) {
    if (dsdModified.size === 0) return

    const clonesOf = buildClonesMap()

    const queue = [...dsdModified]
    const visited = new Set<string>()
    for (let sourceId = queue.shift(); sourceId !== undefined; sourceId = queue.shift()) {
      const source = graph.getNode(sourceId)
      if (!source) continue
      const clones = clonesOf.get(sourceId)
      if (!clones) continue
      for (const cloneId of clones) {
        if (visited.has(cloneId)) continue
        visited.add(cloneId)
        const clone = graph.getNode(cloneId)
        if (!clone) continue
        if (!dsdSizeSet.has(cloneId)) {
          const cu: Partial<SceneNode> = {}
          if (source.width !== clone.width) cu.width = source.width
          if (source.height !== clone.height) cu.height = source.height
          if (source.x !== clone.x) cu.x = source.x
          if (source.y !== clone.y) cu.y = source.y
          if (source.fillGeometry !== clone.fillGeometry) cu.fillGeometry = copyGeometryPaths(source.fillGeometry)
          if (source.strokeGeometry !== clone.strokeGeometry) cu.strokeGeometry = copyGeometryPaths(source.strokeGeometry)
          if (Object.keys(cu).length > 0) graph.updateNode(cloneId, cu)
        }
        queue.push(cloneId)
      }
    }
  }

  function applyDerivedSymbolData() {
    const { dsdModified, dsdSizeSet } = resolveDsdUpdates()
    propagateDsdChanges(dsdModified, dsdSizeSet)
  }

  function applySymbolOverrides(): Set<string> {
    const overriddenNodes = new Set<string>()
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

        const { guidPath: _, overriddenSymbolID: _s, componentPropAssignments: _c, ...fields } = ov
        if (Object.keys(fields).length === 0) continue

        const updates = convertOverrideToProps(fields as Record<string, unknown>)
        if (Object.keys(updates).length > 0) {
          graph.updateNode(targetId, updates)
        }
      }
    }
    return overriddenNodes
  }

  function syncNodeProps(source: SceneNode, target: SceneNode) {
    const updates: Partial<SceneNode> = {}
    if (source.text !== target.text) updates.text = source.text
    if (source.visible !== target.visible) updates.visible = source.visible
    if (source.opacity !== target.opacity) updates.opacity = source.opacity
    if (source.fills !== target.fills) updates.fills = copyFills(source.fills)
    if (source.strokes !== target.strokes) updates.strokes = copyStrokes(source.strokes)
    if (source.effects !== target.effects) updates.effects = copyEffects(source.effects)
    if (source.styleRuns !== target.styleRuns) updates.styleRuns = copyStyleRuns(source.styleRuns)
    if (source.layoutGrow !== target.layoutGrow) updates.layoutGrow = source.layoutGrow
    if (source.textAutoResize !== target.textAutoResize) updates.textAutoResize = source.textAutoResize
    if (source.locked !== target.locked) updates.locked = source.locked
    if (Object.keys(updates).length > 0) graph.updateNode(target.id, updates)
  }

  function syncChildrenDeep(sourceId: string, targetId: string, skip?: Set<string>) {
    const src = graph.getNode(sourceId)
    const tgt = graph.getNode(targetId)
    if (!src || !tgt) return
    const len = Math.min(src.childIds.length, tgt.childIds.length)
    for (let i = 0; i < len; i++) {
      if (skip?.has(tgt.childIds[i])) continue
      const srcNode = graph.getNode(src.childIds[i])
      const tgtNode = graph.getNode(tgt.childIds[i])
      if (!srcNode || !tgtNode || srcNode.type !== tgtNode.type) continue
      syncNodeProps(srcNode, tgtNode)
      syncChildrenDeep(src.childIds[i], tgt.childIds[i], skip)
    }
  }

  function buildClonesMap(): Map<string, string[]> {
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
    return clonesOf
  }

  function expandSeedsToParents(seeds: Set<string>): Set<string> {
    const expandedSeeds = new Set(seeds)
    for (const seedId of seeds) {
      let cur = graph.getNode(seedId)
      while (cur?.parentId) {
        const parent = graph.getNode(cur.parentId)
        if (!parent) break
        if (parent.type === 'INSTANCE' || parent.type === 'COMPONENT') {
          expandedSeeds.add(parent.id)
        }
        cur = parent
      }
    }
    return expandedSeeds
  }

  function buildNeedsSyncSet(expandedSeeds: Set<string>, clonesOf: Map<string, string[]>): Set<string> {
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

  function syncCloneFromSource(sourceId: string, source: SceneNode, node: SceneNode, seeds: Set<string>) {
    syncNodeProps(source, node)
    if (source.childIds.length !== node.childIds.length) {
      const childIds = [...node.childIds]
      for (const childId of childIds) graph.deleteNode(childId)
      if (source.childIds.length > 0) {
        graph.populateInstanceChildren(node.id, sourceId)
      }
    } else if (source.childIds.length > 0 && node.childIds.length > 0) {
      syncChildrenDeep(sourceId, node.id, seeds)
    }
  }

  function propagateOverridesTransitively(seeds: Set<string>) {
    if (seeds.size === 0) return

    const clonesOf = buildClonesMap()
    const expandedSeeds = expandSeedsToParents(seeds)
    const needsSync = buildNeedsSyncSet(expandedSeeds, clonesOf)

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

        // Don't overwrite nodes directly targeted by symbolOverrides
        if (seeds.has(cloneId)) {
          syncQueue.push(cloneId)
          continue
        }

        syncCloneFromSource(sourceId, source, node, seeds)
        syncQueue.push(cloneId)
      }
    }
  }

  // Order matters:
  // 1. symbolOverrides — set property values and swap instances
  // 2. transitive sync — propagate overrides through clone chains (may
  //    repopulate INSTANCE children, wiping any earlier property changes)
  // 3. componentProperties — toggle visibility / swap via prop assignments
  //    (must run AFTER sync so repopulated children aren't lost)
  // 4. derivedSymbolData — apply Figma's pre-computed sizes last
  const t2 = profileStart()
  const overriddenNodes = applySymbolOverrides()
  profileStage('4f3_applySymbolOverrides', t2)

  const t3 = profileStart()
  propagateOverridesTransitively(overriddenNodes)
  profileStage('4f4_propagateOverridesTransitively', t3)

  const t4 = profileStart()
  applyComponentProperties()
  profileStage('4f5_applyComponentProperties', t4)

  const t5 = profileStart()
  // DSD resolution runs AFTER overrides so guidPaths can reach children
  // of instance-swapped nodes (repopulateInstance replaces children).
  applyDerivedSymbolData()
  profileStage('4f6_applyDerivedSymbolData', t5)
}
