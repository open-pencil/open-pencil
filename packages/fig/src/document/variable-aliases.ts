import type { SceneGraph, VariableValue } from '@open-pencil/scene-graph'

export interface VariableAliasDiagnostic {
  variableId: string
  modeId: string
  targetId: string
  reason: 'missing-target' | 'type-mismatch' | 'potential-cycle'
}

function aliasId(value: VariableValue): string | undefined {
  return typeof value === 'object' && 'aliasId' in value ? value.aliasId : undefined
}

/** Validate aliases structurally without guessing mode mappings or rewriting values. */
export function validateVariableAliases(graph: SceneGraph): VariableAliasDiagnostic[] {
  const diagnostics: VariableAliasDiagnostic[] = []
  const edges = new Map<string, Set<string>>()
  for (const variable of graph.variables.values()) {
    for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
      const targetId = aliasId(value)
      if (!targetId) continue
      const target = graph.variables.get(targetId)
      if (!target || target.type !== variable.type) {
        diagnostics.push({
          variableId: variable.id,
          modeId,
          targetId,
          reason: target ? 'type-mismatch' : 'missing-target'
        })
        continue
      }
      const targets = edges.get(variable.id) ?? new Set<string>()
      targets.add(targetId)
      edges.set(variable.id, targets)
    }
  }
  const reaches = (from: string, target: string, seen: Set<string>): boolean => {
    if (from === target) return true
    if (seen.has(from)) return false
    seen.add(from)
    for (const next of edges.get(from) ?? []) if (reaches(next, target, seen)) return true
    return false
  }
  for (const variable of graph.variables.values()) {
    for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
      const targetId = aliasId(value)
      if (
        targetId &&
        edges.get(variable.id)?.has(targetId) &&
        reaches(targetId, variable.id, new Set())
      ) {
        diagnostics.push({ variableId: variable.id, modeId, targetId, reason: 'potential-cycle' })
      }
    }
  }
  return diagnostics
}
