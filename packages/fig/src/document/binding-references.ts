import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'

import { symbolOverridesOf, type SymbolOverride } from '../instance-overrides/types'
import { variableConsumptionEntries } from '../node-change/variable-bindings'
import { visitVariableReferences } from '../node-change/variable-expression'
import { normalizeComponentPropertyRecords } from './property-records'
import { createResourceResolver } from './resource-reference'

export interface BindingReferenceDiagnostic {
  sourceId: string
  field: string
  key: string
  path: readonly GUID[]
}

function visitChildren(
  node: NodeChange,
  path: readonly GUID[],
  visit: (node: NodeChange, path: readonly GUID[]) => void
): void {
  for (const override of symbolOverridesOf(node)) {
    visit(override as NodeChange, [...path, ...(override.guidPath?.guids ?? [])])
  }
  for (const derived of (node.derivedSymbolData as SymbolOverride[] | undefined) ?? []) {
    visit(derived as NodeChange, [...path, ...(derived.guidPath?.guids ?? [])])
  }
}

/** Normalize supported binding references without mutating archive records or effective values. */
export function resolveDocumentBindingReferences(
  changes: readonly NodeChange[],
  report: (diagnostic: BindingReferenceDiagnostic) => void,
  ownership: 'copy' | 'transfer' = 'copy'
): NodeChange[] {
  const resolve = createResourceResolver(changes)
  return changes.map((source) => {
    const node = ownership === 'transfer' ? source : structuredClone(source)
    const sourceId = source.guid ? `${source.guid.sessionID}:${source.guid.localID}` : 'unknown'
    const normalize = (
      reference: NodeChange['variableSetID'],
      field: string,
      path: readonly GUID[]
    ): void => {
      if (!reference?.assetRef || reference.guid) return
      const id = resolve(reference)
      if (!id) {
        report({ sourceId, field, key: reference.assetRef.key, path: structuredClone(path) })
        return
      }
      reference.guid = stringToGuid(id)
    }
    const visit = (node: NodeChange, path: readonly GUID[]): void => {
      normalizeComponentPropertyRecords(node)
      for (const entry of variableConsumptionEntries(node)) {
        visitVariableReferences(entry.variableData, (reference) =>
          normalize(reference, entry.variableField ?? 'unknown', path)
        )
      }
      for (const [field, paints] of [
        ['fillPaints', node.fillPaints],
        ['strokePaints', node.strokePaints]
      ] as const) {
        for (const paint of paints ?? []) normalize(paint.colorVar?.value?.alias, field, path)
      }
      const modeMap = node.variableModeBySetMap as
        | {
            entries?: Array<{ variableSetID?: NodeChange['variableSetID']; variableModeID?: GUID }>
          }
        | undefined
      for (const entry of modeMap?.entries ?? []) {
        normalize(entry.variableSetID, 'variableModeBySetMap', path)
      }
      for (const field of [
        'styleIdForText',
        'styleIdForFill',
        'styleIdForStrokeFill',
        'styleIdForEffect',
        'styleIdForGrid'
      ] as const) {
        normalize(node[field] as NodeChange['variableSetID'], field, path)
      }
      visitChildren(node, path, visit)
    }
    visit(node, [])
    return node
  })
}
