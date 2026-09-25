import { forEachInstanceOverride } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  resolvedNumericBindingUpdate,
  numericVariableBindingScales
} from '../node-change/variable-bindings'

/** Apply resolved scalar layout values after hierarchy and explicit modes exist. */
export function applyDocumentLayoutBindings(
  graph: SceneGraph,
  savedSizeNodes: ReadonlySet<string>,
  materialized: readonly SceneNode[],
  layoutScales: ReadonlyMap<string, number> = new Map()
): void {
  // An instance and the descendants its overrides name materialize together, so the owners
  // that matter for these nodes are among them.
  const sizesOverridden = new Map<string, Set<string>>()
  for (const owner of materialized) {
    if (owner.type !== 'INSTANCE') continue
    forEachInstanceOverride(owner.instanceOverrides, (id, field) => {
      if (field !== 'width' && field !== 'height') return
      const target = id || owner.id
      const fields = sizesOverridden.get(target) ?? new Set<string>()
      fields.add(field)
      sizesOverridden.set(target, fields)
    })
  }
  for (const node of materialized) {
    const scales = numericVariableBindingScales(
      node.boundVariables,
      layoutScales.get(node.id) ?? 1,
      node.variableBindingScales
    )
    graph.updateNode(node.id, { variableBindingScales: scales })
    for (const field in node.boundVariables) {
      if ((field === 'width' || field === 'height') && savedSizeNodes.has(node.id)) continue
      if (sizesOverridden.get(node.id)?.has(field)) continue
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
