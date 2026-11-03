import type { GUID } from '@open-pencil/kiwi/fig'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import type { VariableConsumptionSource } from './bindings'

export interface FigVariableModeMap {
  entries?: Array<{
    variableSetID?: { guid?: GUID }
    variableModeID?: GUID
  }>
}

type VariableModeEntry = NonNullable<FigVariableModeMap['entries']>[number]

const NO_FIELDS: Readonly<Record<string, unknown>> = {}

function variableModeEntries(node: VariableConsumptionSource): VariableModeEntry[] {
  return (node.variableModeBySetMap as FigVariableModeMap | undefined)?.entries ?? []
}

function collectionKey(entry: VariableModeEntry): string | undefined {
  const collection = entry.variableSetID?.guid
  return collection ? guidToString(collection) : undefined
}

export function variableModeLayer(
  node: VariableConsumptionSource
): Map<string, string | undefined> {
  const layer = new Map<string, string | undefined>()
  for (const entry of variableModeEntries(node)) {
    const key = collectionKey(entry)
    if (key) {
      layer.set(key, entry.variableModeID ? guidToString(entry.variableModeID) : undefined)
    }
  }
  return layer
}

export function mergeVariableModeMaps(
  base: VariableConsumptionSource,
  patch: VariableConsumptionSource
): Readonly<Record<string, unknown>> {
  if (!('variableModeBySetMap' in patch)) {
    return NO_FIELDS
  }
  return mergedModeMap(base, patch, 'clear')
}

export function mergeVariableModeClaims(
  earlier: VariableConsumptionSource,
  later: VariableConsumptionSource
): Readonly<Record<string, unknown>> {
  if (!('variableModeBySetMap' in later) || !('variableModeBySetMap' in earlier)) {
    return NO_FIELDS
  }
  return mergedModeMap(earlier, later, 'keep')
}

/**
 * One mode map from two, the later entry winning per collection. A cleared entry, one without
 * a mode, either clears the collection (`clear`, applying a layer) or stays as a claim to clear
 * it (`keep`, merging claims for export).
 */
function mergedModeMap(
  earlier: VariableConsumptionSource,
  later: VariableConsumptionSource,
  cleared: 'clear' | 'keep'
): Readonly<Record<string, unknown>> {
  const unresolved: VariableModeEntry[] = []
  const byCollection = new Map<string, VariableModeEntry>()
  for (const entry of [...variableModeEntries(earlier), ...variableModeEntries(later)]) {
    const key = collectionKey(entry)
    if (!key) {
      unresolved.push(entry)
    } else if (entry.variableModeID || cleared === 'keep') {
      byCollection.set(key, entry)
    } else {
      byCollection.delete(key)
    }
  }
  const entries = [...byCollection.values(), ...unresolved]
  return { variableModeBySetMap: { entries: structuredClone(entries) } }
}
