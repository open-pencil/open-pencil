import type { SceneGraph } from '../index'
import type { GraphTransferPlan } from './apply'
import { semanticTransferReferences } from './nodes'

/** Refuse to remove transferred content that has acquired external dependents. */
export function removeGraphTransfer(graph: SceneGraph, plan: GraphTransferPlan): void {
  const nodes = new Set(plan.nodes.map((node) => node.id))
  const variables = new Set(plan.variables.map((variable) => variable.id))
  const collections = new Set(plan.collections.map((collection) => collection.id))
  const referencesOwned = (value: unknown): boolean => {
    if (typeof value === 'string')
      return nodes.has(value) || variables.has(value) || collections.has(value)
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return false
    if (value instanceof Map)
      return [...value].some(([key, item]) => referencesOwned(key) || referencesOwned(item))
    return Object.values(value).some(referencesOwned)
  }
  for (const node of graph.getAllNodes()) {
    if (nodes.has(node.id)) {
      if (node.childIds.some((id) => !nodes.has(id)))
        throw new Error('Transferred node has non-owned children')
      continue
    }
    if (semanticTransferReferences(node).some(referencesOwned))
      throw new Error(`Transferred content is referenced by ${node.id}`)
  }
  for (const variable of graph.variables.values()) {
    if (!variables.has(variable.id) && referencesOwned(variable.valuesByMode))
      throw new Error('Transferred variable has external aliases')
  }
  graph.withBufferedEvents(() => {
    for (const node of plan.nodes.toReversed()) graph.deleteNode(node.id)
    for (const id of variables) graph.variables.delete(id)
    for (const id of collections) {
      graph.variableCollections.delete(id)
      graph.activeMode.delete(id)
    }
  })
}
