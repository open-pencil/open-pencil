import type { SceneNode } from '../types'
import { NUMERIC_FIELDS } from './fields'

export function scaleVariableBindingUnits(node: SceneNode, factor: number): Partial<SceneNode> {
  const variableBindingScales = { ...node.variableBindingScales }
  const variableAssignmentScales = { ...node.variableAssignmentScales }
  for (const field of NUMERIC_FIELDS) {
    if (field === 'opacity' || field === 'rotation') continue
    if (field in node.boundVariables)
      variableBindingScales[field] = (variableBindingScales[field] ?? 1) * factor
    if (node.type === 'INSTANCE')
      variableAssignmentScales[field] = (variableAssignmentScales[field] ?? 1) * factor
  }
  return { variableBindingScales, variableAssignmentScales }
}
