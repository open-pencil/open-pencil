export type {
  InstanceNodeChange,
  OverrideContext,
  ComponentPropAssignment,
  ComponentPropDef,
  ComponentPropRef,
  ComponentPropValue,
  DerivedSymbolOverride,
  SymbolData,
  SymbolOverride
} from './types'

import { copyFills } from '../../scene-graph/copy'
import { guidToString } from '../convert'
import { applyConstraintScaling } from './constraints'
import { applyDerivedSymbolData } from './dsd'
import { populateInstances } from './populate'
import { applyComponentProperties } from './props'
import { preComputeRoots } from './resolve'
import { applySymbolOverrides } from './symbol-overrides'
import { propagateOverridesTransitively } from './sync'

import type { SceneGraph } from '../../scene-graph'
import type { InstanceNodeChange, OverrideContext, ComponentPropValue } from './types'

/**
 * Identify nodes whose kiwi NC has explicit property values that DIFFER
 * from their component source. Only these need protection from sync.
 */
function buildKiwiPropertyNodes(
  graph: SceneGraph,
  changeMap: Map<string, InstanceNodeChange>,
  guidToNodeId: Map<string, string>
): Set<string> {
  const result = new Set<string>()
  for (const [figmaId, nodeId] of guidToNodeId) {
    const nc = changeMap.get(figmaId) as Record<string, unknown> | undefined
    if (!nc) continue
    const node = graph.getNode(nodeId)
    if (!node?.componentId) continue
    const comp = graph.getNode(node.componentId)
    if (!comp) continue
    const hasDiffRadius =
      (nc.cornerRadius !== undefined || nc.rectangleCornerRadiiIndependent !== undefined) &&
      node.cornerRadius !== comp.cornerRadius
    const hasDiffVisible = nc.visible === false && comp.visible
    if (hasDiffRadius || hasDiffVisible) result.add(nodeId)
  }
  return result
}

function propagateResolvedFills(graph: SceneGraph, protectedNodes: Set<string>): void {
  for (let pass = 0; pass < 10; pass++) {
    let changed = false
    for (const node of graph.getAllNodes()) {
      if (!node.componentId) continue
      const source = graph.getNode(node.componentId)
      if (!source || source.fills === node.fills) continue
      if (protectedNodes.has(node.id) && !protectedNodes.has(source.id)) continue
      graph.updateNode(node.id, { fills: copyFills(source.fills) })
      changed = true
    }
    if (!changed) return
  }
}

function buildOverrideContext(
  graph: SceneGraph,
  changeMap: Map<string, InstanceNodeChange>,
  guidToNodeId: Map<string, string>,
  blobs: Uint8Array[]
): OverrideContext {
  const overrideKeyToGuid = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (nc.overrideKey) overrideKeyToGuid.set(guidToString(nc.overrideKey), id)
  }

  const propDefaults = new Map<string, ComponentPropValue>()
  for (const [, nc] of changeMap) {
    if (!nc.componentPropDefs?.length) continue
    for (const def of nc.componentPropDefs) {
      if (def.id && def.initialValue) {
        propDefaults.set(guidToString(def.id), def.initialValue)
      }
    }
  }

  const nodeIdToGuid = new Map<string, string>()
  for (const [figmaId, nodeId] of guidToNodeId) {
    nodeIdToGuid.set(nodeId, figmaId)
  }

  const kiwiPropertyNodes = buildKiwiPropertyNodes(graph, changeMap, guidToNodeId)

  return {
    graph,
    changeMap,
    guidToNodeId,
    blobs,
    overrideKeyToGuid,
    nodeIdToGuid,
    propDefaults,
    preComputedRoot: new Map(),
    componentIdRoot: new Map(),
    swappedInstances: new Set(),
    kiwiPropertyNodes
  }
}

/**
 * Populate empty instances from their components and apply symbol overrides.
 *
 * Shared between .fig file import and clipboard paste. Both paths produce
 * a SceneGraph with INSTANCE nodes whose componentId references have been
 * remapped to graph node IDs but whose children may be missing and whose
 * overrides have not yet been applied.
 *
 * Resolution order:
 * 1. Populate — clone component trees into empty instances
 * 2. Symbol overrides — set property values and swap instances
 * 3. Transitive sync — propagate overrides through clone chains
 * 4. Component properties — toggle visibility / swap via prop assignments
 * 5. Second transitive sync — propagate property changes to deeper clones
 * 6. Derived symbol data — apply Figma's pre-computed sizes last
 */
export function populateAndApplyOverrides(
  graph: SceneGraph,
  changeMap: Map<string, InstanceNodeChange>,
  guidToNodeId: Map<string, string>,
  blobs: Uint8Array[] = []
): void {
  populateInstances(graph)

  const ctx = buildOverrideContext(graph, changeMap, guidToNodeId, blobs)
  preComputeRoots(ctx)

  const overriddenNodes = applySymbolOverrides(ctx)

  // Nodes with explicit kiwi NC properties are seeds (so their clones get
  // synced with the correct values) AND protected (so sync doesn't overwrite
  // them with component defaults).
  for (const id of ctx.kiwiPropertyNodes) overriddenNodes.add(id)
  propagateOverridesTransitively(graph, overriddenNodes, ctx.swappedInstances, ctx.componentIdRoot)

  const propModified = applyComponentProperties(ctx)
  if (propModified.size > 0) {
    propagateOverridesTransitively(
      graph,
      propModified,
      ctx.swappedInstances,
      ctx.componentIdRoot,
      overriddenNodes
    )
  }

  applyDerivedSymbolData(ctx)
  propagateResolvedFills(graph, new Set([...ctx.kiwiPropertyNodes, ...overriddenNodes]))
  applyConstraintScaling(ctx)
}
