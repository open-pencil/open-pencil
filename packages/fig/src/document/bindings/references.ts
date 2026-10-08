import { symbolOverridesOf, type SymbolOverride } from '#fig/instance-overrides/types'
import { variableConsumptionEntries } from '#fig/node-change/variable/bindings'
import { visitVariableReferences } from '#fig/node-change/variable/expression'

import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'

import { normalizeComponentPropertyRecords } from '../property-records'
import { createResourceResolver } from '../resource-reference'
import { STYLE_REFERENCE_FIELDS } from '../style-dependencies'

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

type Report = (diagnostic: BindingReferenceDiagnostic) => void

/** Lazily decoded fields that can hold binding references of their own. */
const BINDING_FIELDS = new Set(['parameterConsumptionMap', 'derivedSymbolData'])

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
        normalize(node[field] as NodeChange['variableSetID'], field, path)
      }
      visitChildren(node, path, visit)
    }
    visit(record, [])
  }
}

export interface DocumentBindingReferences {
  changes: NodeChange[]
  /**
   * Resolves the references in a value a lazily decoded field of `record` just produced, as the
   * document pass resolved the value it read then. That value is not kept, so every read
   * resolves again; only the document pass reports what names nothing.
   */
  prepareLazyField: (record: NodeChange, field: string, value: unknown) => void
}

/** Normalize supported binding references without mutating archive records or effective values. */
export function resolveDocumentBindingReferences(
  changes: readonly NodeChange[],
  report: Report,
  ownership: 'copy' | 'transfer' = 'copy'
): DocumentBindingReferences {
  const normalizeRecord = createRecordNormalizer(createResourceResolver(changes))
  return {
    changes: changes.map((source) => {
      const node = ownership === 'transfer' ? source : structuredClone(source)
      normalizeRecord(node, source.guid ? guidToString(source.guid) : 'unknown', report)
      return node
    }),
    prepareLazyField: (record, field, value) => {
      // A modern parameter entry shadows the legacy entry for the same field, which the document
      // pass leaves as saved, so the legacy map resolves beside the record's parameter map.
      if (field === 'variableConsumptionMap')
        normalizeRecord(
          {
            variableConsumptionMap: value,
            parameterConsumptionMap: record.parameterConsumptionMap
          } as NodeChange,
          'lazy'
        )
      else if (BINDING_FIELDS.has(field)) normalizeRecord({ [field]: value } as NodeChange, 'lazy')
    }
  }
}
