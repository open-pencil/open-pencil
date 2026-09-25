import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { setInstanceOverride, type SceneNode } from '@open-pencil/scene-graph'

import {
  variableConsumptionEntries,
  numericVariableAssignmentScales,
  VARIABLE_BINDING_FIELDS_INVERSE
} from '../node-change/variable-bindings'
import { linearVariableExpression } from '../node-change/variable-expression'
import type { InstanceOccurrence } from './interpret'
import { uniformScaleOf } from './types'

export function occurrenceScale(occurrence: InstanceOccurrence): number {
  return occurrence.layoutScale ?? 1
}

export function occurrenceAssignmentScales(occurrence: InstanceOccurrence): Record<string, number> {
  return numericVariableAssignmentScales(
    occurrence.mainComponentId !== null ? occurrenceScale(occurrence) : 1
  )
}

export function recordVariableBindingClaims(
  owner: SceneNode,
  target: SceneNode,
  patch: NodeChange
): void {
  for (const entry of variableConsumptionEntries(patch)) {
    if (entry.variableData && !['ALIAS', 'EXPRESSION'].includes(entry.variableData.dataType ?? ''))
      continue
    const field = entry.variableField && VARIABLE_BINDING_FIELDS_INVERSE[entry.variableField]
    if (!field) continue
    setInstanceOverride(
      owner.instanceOverrides,
      owner.id,
      target.id,
      `boundVariables/${field}`,
      target.boundVariables[field] ?? null
    )
    setInstanceOverride(owner.instanceOverrides, owner.id, target.id, 'boundVariables')
  }
}

/** New declarations enter the current owner's pre-scale space, not the target's old space. */
export function declareSourceVariableBindingUnits(
  target: InstanceOccurrence,
  source: NodeChange
): void {
  const scale = uniformScaleOf(source)
  declareVariableBindingUnits(target, source, scale)
}

export function declareVariableBindingUnits(
  target: InstanceOccurrence,
  patch: NodeChange,
  ownScale = 1
): void {
  for (const entry of variableConsumptionEntries(patch)) {
    const field = entry.variableField && VARIABLE_BINDING_FIELDS_INVERSE[entry.variableField]
    if (!field) continue
    target.variableBindingScales ??= {}
    const expression = linearVariableExpression(entry.variableData)
    const multiplier = expression?.reference ? expression.multiplier : 1
    const unit = field === 'opacity' ? 0.01 : 1
    const expressionInPlacedUnits =
      entry.variableData?.value?.expressionValue && field !== 'opacity' && field !== 'rotation'
    target.variableBindingScales[field] =
      (multiplier * unit) / (expressionInPlacedUnits ? ownScale : 1)
  }
}
