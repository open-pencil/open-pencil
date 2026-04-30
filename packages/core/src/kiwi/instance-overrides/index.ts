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

import { guidToString } from '#core/kiwi/node-change/convert'
import { copyFills } from '#core/scene-graph/copy'

import { applyConstraintScaling } from './constraints'
import { applyDerivedSymbolData } from './dsd'
import { populateInstances } from './populate'
import { applyComponentProperties } from './props'
import { preComputeRoots } from './resolve'
import { applySymbolOverrides } from './symbol/overrides'
import { propagateOverridesTransitively } from './sync'

import type { SceneGraph } from '#core/scene-graph'
import type { InstanceNodeChange, OverrideContext, ComponentPropValue } from './types'

/**
 * Identify nodes whose kiwi NC has explicit property values that DIFFER
 * from their component source. Only these need protection from sync.
 */
function* changedNodeEntries(
  changeMap: Map<string, InstanceNodeChange>,
  guidToNodeId: Map<string, string>
): Generator<[string, InstanceNodeChange]> {
  for (const [figmaId, nodeId] of guidToNodeId) {
    const nc = changeMap.get(figmaId)
    if (nc) yield [nodeId, nc]
  }
}

function buildKiwiPropertyNodes(
  graph: SceneGraph,
  changeMap: Map<string, InstanceNodeChange>,
  guidToNodeId: Map<string, string>
): Set<string> {
  const result = new Set<string>()
  for (const [nodeId, change] of changedNodeEntries(changeMap, guidToNodeId)) {
    const nc = change as Record<string, unknown>
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

function buildKiwiGeometryNodes(
  changeMap: Map<string, InstanceNodeChange>,
  guidToNodeId: Map<string, string>
): Set<string> {
  const result = new Set<string>()
  for (const [nodeId, nc] of changedNodeEntries(changeMap, guidToNodeId)) {
    if (nc.fillGeometry?.length || nc.strokeGeometry?.length) result.add(nodeId)
  }
  return result
}

function propagateResolvedFills(
  graph: SceneGraph,
  protectedNodes: Set<string>,
  activeNodeIds?: Set<string>
): void {
  for (let pass = 0; pass < 10; pass++) {
    let changed = false
    for (const node of graph.getAllNodes()) {
      if (activeNodeIds && !activeNodeIds.has(node.id)) continue
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
  blobs: Uint8Array[],
  activeNodeIds?: Set<string>
): OverrideContext {
  const overrideKeyToGuid = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (nc.overrideKey) overrideKeyToGuid.set(guidToString(nc.overrideKey), id)
  }

  const propDefaults = new Map<string, ComponentPropValue>()
  const propNames = new Map<string, string>()
  for (const [, nc] of changeMap) {
    if (!nc.componentPropDefs?.length) continue
    for (const def of nc.componentPropDefs) {
      if (!def.id) continue
      const id = guidToString(def.id)
      if (def.initialValue) propDefaults.set(id, def.initialValue)
      if (def.name) propNames.set(id, def.name)
    }
  }

  const nodeIdToGuid = new Map<string, string>()
  for (const [figmaId, nodeId] of guidToNodeId) {
    nodeIdToGuid.set(nodeId, figmaId)
  }

  const kiwiPropertyNodes = buildKiwiPropertyNodes(graph, changeMap, guidToNodeId)
  const geometryOverrideNodes = buildKiwiGeometryNodes(changeMap, guidToNodeId)

  return {
    graph,
    changeMap,
    guidToNodeId,
    blobs,
    overrideKeyToGuid,
    nodeIdToGuid,
    propDefaults,
    propNames,
    preComputedRoot: new Map(),
    componentIdRoot: new Map(),
    swappedInstances: new Set(),
    kiwiPropertyNodes,
    geometryOverrideNodes,
    activeNodeIds
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
  blobs: Uint8Array[] = [],
  activeRootIds?: Iterable<string>
): void {
  const activeNodeIds = populateInstances(graph, activeRootIds)

  const ctx = buildOverrideContext(graph, changeMap, guidToNodeId, blobs, activeNodeIds)
  preComputeRoots(ctx)

  const overriddenNodes = applySymbolOverrides(ctx)

  // Nodes with explicit kiwi NC properties are seeds (so their clones get
  // synced with the correct values) AND protected (so sync doesn't overwrite
  // them with component defaults).
  for (const id of ctx.kiwiPropertyNodes) overriddenNodes.add(id)
  propagateOverridesTransitively(
    graph,
    overriddenNodes,
    ctx.swappedInstances,
    ctx.componentIdRoot,
    undefined,
    ctx.activeNodeIds
  )

  const propModified = applyComponentProperties(ctx)
  if (propModified.size > 0) {
    propagateOverridesTransitively(
      graph,
      propModified,
      ctx.swappedInstances,
      ctx.componentIdRoot,
      overriddenNodes,
      ctx.activeNodeIds
    )
  }

  if (activeRootIds) {
    const populated = populateInstances(graph, activeRootIds)
    if (populated) ctx.activeNodeIds = populated
    const latePropModified = applyComponentProperties(ctx)
    if (latePropModified.size > 0) {
      propagateOverridesTransitively(
        graph,
        latePropModified,
        ctx.swappedInstances,
        ctx.componentIdRoot,
        overriddenNodes,
        ctx.activeNodeIds
      )
    }
  }

  applyDerivedSymbolData(ctx)
  propagateResolvedFills(
    graph,
    new Set([...ctx.kiwiPropertyNodes, ...overriddenNodes]),
    ctx.activeNodeIds
  )
  applyConstraintScaling(ctx)
}
