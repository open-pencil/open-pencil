import type { SceneGraph } from '@open-pencil/scene-graph'

import { resolvedNumericBindingUpdate } from '../node-change/variable-bindings'

/** Apply resolved scalar layout values after hierarchy and explicit modes exist. */
export function applyDocumentLayoutBindings(graph: SceneGraph): void {
  for (const node of graph.getAllNodes()) {
    for (const [field, variableId] of Object.entries(node.boundVariables)) {
      const variable = graph.variables.get(variableId)
      if (!variable) continue
      const modeId = graph.getNodeVariableModeId(node.id, variable.collectionId)
      const value = graph.resolveVariable(variableId, modeId)
      if (typeof value !== 'number') continue
      const updates = resolvedNumericBindingUpdate(field, value)
      if (updates) graph.updateNode(node.id, updates)
    }
  }
}
