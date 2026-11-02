import { symbolOverridesOf, type SymbolOverride } from '#fig/instance-overrides/types'
import { variableConsumptionEntries } from '#fig/node-change/variable/bindings'
import { visitVariableReferences } from '#fig/node-change/variable/expression'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'

import { normalizeComponentPropertyRecords } from '../property-records'
import { createResourceResolver } from '../resource-reference'
import { STYLE_REFERENCE_FIELDS, vectorStyleTable } from '../style-dependencies'

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
    visit(override, [...path, ...(override.guidPath?.guids ?? [])])
  }
  for (const derived of (node.derivedSymbolData as SymbolOverride[] | undefined) ?? []) {
    visit(derived, [...path, ...(derived.guidPath?.guids ?? [])])
  }
}

type Report = (diagnostic: BindingReferenceDiagnostic) => void

/** Resolves a record's binding references in place, reporting the ones that name nothing. */
function createRecordNormalizer(resolve: ReturnType<typeof createResourceResolver>) {
  return (record: NodeChange, sourceId: string, report?: Report): void => {
    const normalize = (
      reference: NodeChange['variableSetID'],
      field: string,
      path: readonly GUID[]
    ): void => {
      if (!reference?.assetRef || reference.guid) return
      const id = resolve(reference)
      if (!id) {
        report?.({ sourceId, field, key: reference.assetRef.key, path: structuredClone(path) })
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
      for (const field of STYLE_REFERENCE_FIELDS) {
        normalize(node[field], field, path)
      }
      // A text's ranges and a vector's regions bind variables and use styles in their own style
      // overrides.
      for (const override of node.textData?.styleOverrideTable ?? []) visit(override, path)
      for (const override of vectorStyleTable(node)) visit(override, path)
      visitChildren(node, path, visit)
    }
    visit(record, [])
  }
}

/**
 * Resolves the binding references of one whole record in place, as the document pass resolves
 * every record: against the given records' variables, reporting what names nothing when asked.
 */
export function createBindingNormalizer(resources: readonly NodeChange[]) {
  const normalizeRecord = createRecordNormalizer(createResourceResolver(resources))
  return (record: NodeChange, report?: Report): void =>
    normalizeRecord(record, record.guid ? guidToString(record.guid) : 'unknown', report)
}

/** Normalize supported binding references without mutating archive records or effective values. */
export function resolveDocumentBindingReferences(
  changes: readonly NodeChange[],
  report: Report
): NodeChange[] {
  const normalize = createBindingNormalizer(changes)
  return changes.map((source) => {
    const node = structuredClone(source)
    normalize(node, report)
    return node
  })
}
