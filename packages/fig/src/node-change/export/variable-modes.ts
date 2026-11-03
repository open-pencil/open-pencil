import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  getInstanceOverride,
  variableModeOverrideCollection
} from '@open-pencil/scene-graph/instances/overrides'

import type { FigVariableModeMap } from '../variable/maps'
import { parseGuidOrNull, type KiwiNodeChange, type SceneNodeToKiwiContext } from './context'

type VariableModeEntry = NonNullable<FigVariableModeMap['entries']>[number]
type ModeContext = Pick<SceneNodeToKiwiContext, 'graph' | 'varIdToGuid' | 'modeIdToGuid'>

function modeEntry(
  context: ModeContext,
  collectionId: string,
  modeId: string | undefined
): VariableModeEntry[] {
  const collectionGuid = context.varIdToGuid?.get(collectionId) ?? parseGuidOrNull(collectionId)
  if (!collectionGuid) {
    return []
  }
  if (modeId === undefined) {
    return [{ variableSetID: { guid: collectionGuid } }]
  }
  const modeGuid = context.modeIdToGuid?.get(modeId) ?? parseGuidOrNull(modeId)
  return modeGuid ? [{ variableSetID: { guid: collectionGuid }, variableModeID: modeGuid }] : []
}

function ownFields(owner: SceneNode, layer: SceneNode): ReadonlyMap<string, unknown> {
  const state = owner.instanceOverrides
  return (layer.id === owner.id ? state.self : state.descendants.get(layer.id)) ?? new Map()
}

function setsOwnModes(node: SceneNode): boolean {
  return node.type !== 'INSTANCE' || ownFields(node, node).has('variableModes')
}

export function applyVariableModes(
  context: ModeContext,
  node: SceneNode,
  record: KiwiNodeChange
): void {
  if (!setsOwnModes(node)) {
    return
  }
  const entries = Object.entries(node.variableModes).flatMap(([collectionId, modeId]) =>
    modeEntry(context, collectionId, modeId)
  )
  if (entries.length > 0 || node.type === 'INSTANCE') {
    record.variableModeBySetMap = { entries }
  }
}

function sourceIn(scope: SceneNode, layer: SceneNode): string | undefined {
  const state = scope.instanceOverrides
  const source = getInstanceOverride(state, scope.id, layer.id, 'sourceComponentId')
  return typeof source === 'string' ? source : undefined
}

function nearestSource(graph: SceneGraph, layer: SceneNode): string | undefined {
  let scope = layer.parentId ? graph.getNode(layer.parentId) : undefined
  while (scope) {
    const source = scope.type === 'INSTANCE' ? sourceIn(scope, layer) : undefined
    if (source !== undefined) {
      return source
    }
    scope = scope.parentId ? graph.getNode(scope.parentId) : undefined
  }
  return undefined
}

function sourceLayer(
  graph: SceneGraph,
  claimedIn: SceneNode,
  layer: SceneNode
): SceneNode | undefined {
  const source = sourceIn(claimedIn, layer) ?? nearestSource(graph, layer) ?? layer.componentId
  return source ? graph.getNode(source) : undefined
}

export function claimedVariableModes(
  context: ModeContext,
  claimedIn: SceneNode,
  owner: SceneNode,
  layer: SceneNode
): { entries: VariableModeEntry[] } {
  const modes = layer.variableModes
  const sourceModes = sourceLayer(context.graph, claimedIn, layer)?.variableModes ?? {}
  const recorded = [...ownFields(owner, layer).keys()].flatMap(
    (field) => variableModeOverrideCollection(field) ?? []
  )
  const changed = [...Object.keys(modes), ...Object.keys(sourceModes)].filter(
    (collectionId) => modes[collectionId] !== sourceModes[collectionId]
  )
  const claimed = new Set([...recorded, ...changed])
  return {
    entries: [...claimed].flatMap((collectionId) =>
      modeEntry(context, collectionId, modes[collectionId])
    )
  }
}
