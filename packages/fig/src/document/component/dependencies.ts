import {
  forEachOverrideRecord,
  symbolDataOf,
  type ComponentPropAssignment
} from '#fig/instance-overrides/types'

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
  forEachOverrideRecord(node, (source, override) => {
    add(symbolDataOf(source)?.symbolID)
    add(override?.overriddenSymbolID)
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
  })
  return dependencies
}
