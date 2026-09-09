import type { Editor } from '@open-pencil/core/editor'
import type { VariableValue } from '@open-pencil/scene-graph'

import type { BindingTarget } from './types'

/** Validate the effective value without substituting values from other modes. */
export function resolveEffectiveBindingValue(
  editor: Editor,
  variableId: string,
  target: BindingTarget,
  visited = new Set<string>()
): VariableValue | undefined {
  if (visited.has(variableId)) return undefined
  visited.add(variableId)
  const variable = editor.getVariable(variableId)
  if (!variable || !editor.getCollection(variable.collectionId)) return undefined
  const mode = editor.graph.getNodeVariableModeId(target.nodeId, variable.collectionId)
  if (!Object.hasOwn(variable.valuesByMode, mode)) return undefined
  const value = variable.valuesByMode[mode]
  if (value && typeof value === 'object' && 'aliasId' in value) {
    return resolveEffectiveBindingValue(editor, value.aliasId, target, visited)
  }
  return value
}
