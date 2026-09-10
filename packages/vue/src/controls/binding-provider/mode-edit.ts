import type { Editor } from '@open-pencil/core/editor'
import type { Color } from '@open-pencil/scene-graph'

import type { BindingTarget, BindingValueEdit } from './types'

/** Edit the directly bound variable's mode, not a shared alias source.
 * Capturing the raw value lets cancel and Undo restore an alias exactly.
 */
export function prepareModeEdit<V extends number | Color>(
  editor: Editor,
  variableId: string,
  target: BindingTarget,
  resolve: () => V | undefined
): BindingValueEdit<V> | undefined {
  const variable = editor.getVariable(variableId)
  const value = resolve()
  if (!variable || value === undefined) return undefined
  const modeId = editor.graph.getNodeVariableModeId(target.nodeId, variable.collectionId)
  if (!Object.hasOwn(variable.valuesByMode, modeId)) return undefined
  const original = structuredClone(variable.valuesByMode[modeId])
  return {
    restore() {
      editor.updateVariableValue(variableId, modeId, structuredClone(original))
    },
    key: JSON.stringify([variableId, modeId]),
    value: structuredClone(value),
    set(next) {
      editor.updateVariableValue(variableId, modeId, structuredClone(next))
    }
  }
}
