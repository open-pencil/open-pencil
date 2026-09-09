import type { ComponentPropAssignment, SymbolData } from '#fig/instance-overrides/types'

import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

interface DependencyDefinition {
  type?: string
  initialValue?: ComponentPropAssignment['value']
  varValue?: ComponentPropAssignment['varValue']
  preferredValues?: { instanceSwapValues?: Array<{ key?: string; version?: string }> }
}

/** Source dependencies, including inactive defaults needed for later edits. No value/name guessing. */
export function componentDependencies(
  node: NodeChange,
  resolveReference?: (reference: NodeChange['variableSetID']) => string | undefined,
  reportExternalPreferred?: (key: string) => void
): ReadonlySet<string> {
  const dependencies = new Set<string>()
  const add = (guid: GUID | undefined): void => {
    if (guid) dependencies.add(guidToString(guid))
  }
  const assignment = (value: ComponentPropAssignment): void => {
    add(value.value?.guidValue)
    add(value.varValue?.value?.symbolIdValue?.guid)
  }
  const visit = (source: NodeChange): void => {
    const symbol = source.symbolData as SymbolData | undefined
    add(symbol?.symbolID)
    for (const definition of (source.componentPropDefs as DependencyDefinition[] | undefined) ??
      []) {
      if (definition.type === 'INSTANCE_SWAP') {
        assignment({ value: definition.initialValue, varValue: definition.varValue })
        for (const preferred of definition.preferredValues?.instanceSwapValues ?? []) {
          if (!preferred.key) continue
          const id = resolveReference?.({
            assetRef: { key: preferred.key, version: preferred.version }
          })
          if (!id) {
            if (!reportExternalPreferred)
              throw new Error(`Unresolved preferred component ${preferred.key}`)
            reportExternalPreferred(preferred.key)
            continue
          }
          dependencies.add(id)
        }
      }
    }
    for (const value of (source.componentPropAssignments as
      | ComponentPropAssignment[]
      | undefined) ?? [])
      assignment(value)
    for (const override of symbol?.symbolOverrides ?? []) {
      add(override.overriddenSymbolID)
      visit(override as NodeChange)
    }
  }
  visit(node)
  return dependencies
}
