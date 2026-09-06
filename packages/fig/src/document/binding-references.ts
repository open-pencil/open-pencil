import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'

import type { SymbolData, SymbolOverride } from '../instance-overrides/types'
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
  const symbol = node.symbolData as SymbolData | undefined
  for (const override of symbol?.symbolOverrides ?? []) {
    visit(override as NodeChange, [...path, ...(override.guidPath?.guids ?? [])])
  }
  for (const derived of (node.derivedSymbolData as SymbolOverride[] | undefined) ?? []) {
    visit(derived as NodeChange, [...path, ...(derived.guidPath?.guids ?? [])])
  }
}

/** Normalize supported binding references without mutating archive records or effective values. */
export function resolveDocumentBindingReferences(
  changes: readonly NodeChange[],
  report: (diagnostic: BindingReferenceDiagnostic) => void
): NodeChange[] {
  const resolve = createResourceResolver(changes)
  return changes.map((source) => {
    const node = structuredClone(source)
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
      for (const entry of node.variableConsumptionMap?.entries ?? []) {
        normalize(entry.variableData?.value?.alias, entry.variableField ?? 'unknown', path)
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
      visitChildren(node, path, visit)
    }
    visit(node, [])
    return node
  })
}
