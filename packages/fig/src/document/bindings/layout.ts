import {
  resolvedNumericBindingUpdate,
  numericVariableBindingScales
} from '#fig/node-change/variable/bindings'

import { overriddenFields } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** Apply resolved scalar layout values after hierarchy and explicit modes exist. */
export function applyDocumentLayoutBindings(
  graph: SceneGraph,
  savedSizeNodes: ReadonlySet<string>,
  materialized: readonly SceneNode[],
  layoutScales: ReadonlyMap<string, number> = new Map()
): void {
  for (const node of materialized) {
    const overridden = overriddenFields(graph, node)
    const scales = numericVariableBindingScales(
      node.boundVariables,
      layoutScales.get(node.id) ?? 1,
      node.variableBindingScales
    )
    graph.updateNode(node.id, { variableBindingScales: scales })
    for (const field in node.boundVariables) {
      if ((field === 'width' || field === 'height') && savedSizeNodes.has(node.id)) continue
      if ((field === 'width' || field === 'height') && overridden.has(field)) continue
      const variableId = node.boundVariables[field]
      const variable = graph.variables.get(variableId)
      if (!variable) continue
      const modeId = graph.getNodeVariableModeId(node.id, variable.collectionId)
      const value = graph.resolveVariable(variableId, modeId)
      if (typeof value !== 'number') continue
      const effectiveValue = field === 'opacity' ? value : value * (scales[field] ?? 1)
      const updates = resolvedNumericBindingUpdate(field, effectiveValue)
      if (updates) graph.updateNode(node.id, updates)
    }
  }
}
