import type { LayerWriter } from '#design-json/layers'
import { keepsField } from '#design-json/options'
import type { DesignJSONComputed, DesignJSONLayer } from '#design-json/types'
import { stringsIn } from '#design-json/values'
import { compact, uniq } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getNodeVariableModeId, resolveVariableForNode } from '@open-pencil/scene-graph/variables'

/**
 * Adds what the design works out for the layer: the modes it is in, the values its variables
 * resolve to there, and the comment threads pinned to it. Call it before the children are nested,
 * so the variables are the layer's own.
 */
export function addComputed(writer: LayerWriter, node: SceneNode, layer: DesignJSONLayer) {
  if (!writer.options.computed) return
  if (!keepsField('computed', writer.options)) return
  layer.computed = computeLayer(writer, node, layer)
}

function computeLayer(
  writer: LayerWriter,
  node: SceneNode,
  layer: DesignJSONLayer
): DesignJSONComputed {
  const variableIds = variablesUsedBy(writer.graph, layer)
  return {
    variableModes: variableModesOf(writer.graph, node, variableIds),
    variables: resolvedVariablesOf(writer.graph, node, variableIds),
    commentThreadIds: writer.commentThreadIds[node.id] ?? []
  }
}

/** The variables the layer's fields name, wherever they hold them. */
function variablesUsedBy(graph: SceneGraph, layer: DesignJSONLayer): string[] {
  return uniq([...stringsIn(layer)]).filter((id) => graph.variables.has(id))
}

function variableModesOf(
  graph: SceneGraph,
  node: SceneNode,
  variableIds: readonly string[]
): Record<string, string> {
  const collectionIds = uniq(
    compact(variableIds.map((id) => graph.variables.get(id)?.collectionId))
  )
  return Object.fromEntries(
    collectionIds.map((id) => [id, getNodeVariableModeId(graph, node.id, id)])
  )
}

function resolvedVariablesOf(
  graph: SceneGraph,
  node: SceneNode,
  variableIds: readonly string[]
): Record<string, unknown> {
  return Object.fromEntries(variableIds.map((id) => [id, resolvedValue(graph, node, id)]))
}

/** A variable's value for the layer, or null where it does not resolve, as a failing formula. */
function resolvedValue(graph: SceneGraph, node: SceneNode, variableId: string): unknown {
  try {
    return resolveVariableForNode(graph, node.id, variableId) ?? null
  } catch {
    return null
  }
}
