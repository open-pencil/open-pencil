import type { InstancePathDiagnostic } from '@open-pencil/fig/instance-overrides'

export interface CountedPathDiagnostic extends InstancePathDiagnostic {
  occurrences: number
}

/** Group reporting only; repeated evaluations are not distinct source failures. */
export function summarizePathDiagnostics(
  diagnostics: readonly InstancePathDiagnostic[]
): CountedPathDiagnostic[] {
  const groups = new Map<string, CountedPathDiagnostic>()
  for (const diagnostic of diagnostics) {
    const key = JSON.stringify([
      diagnostic.ownerId,
      diagnostic.mainComponentId,
      diagnostic.path,
      diagnostic.reason
    ])
    const previous = groups.get(key)
    if (previous) previous.occurrences++
    else groups.set(key, { ...structuredClone(diagnostic), occurrences: 1 })
  }
  return [...groups.values()].sort((a, b) => b.occurrences - a.occurrences)
}
