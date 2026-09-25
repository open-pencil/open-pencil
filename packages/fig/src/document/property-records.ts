import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'

import type { ComponentPropAssignment, ComponentPropRef } from '../instance-overrides/types'

interface PropertyDefinition {
  initialValue?: ComponentPropAssignment['value']
  varValue?: ComponentPropAssignment['varValue']
}
interface ParameterEntry {
  variableField?: string
  variableData?: { dataType?: string; value?: { propRefValue?: { defId?: GUID } } }
}

/** Adapt current typed property values to the interpreter's common representation. */
function normalizeDefaults(node: NodeChange): void {
  for (const definition of (node.componentPropDefs as PropertyDefinition[] | undefined) ?? []) {
    const value = definition.varValue?.value
    if (definition.initialValue || !value) continue
    definition.initialValue = value.symbolIdValue?.guid
      ? { guidValue: structuredClone(value.symbolIdValue.guid) }
      : structuredClone(value)
  }
}

export function normalizeComponentPropertyRecords(node: NodeChange): void {
  normalizeDefaults(node)
  const parameters = node.parameterConsumptionMap as { entries?: ParameterEntry[] } | undefined
  const refs = structuredClone((node.componentPropRefs as ComponentPropRef[] | undefined) ?? [])
  for (const entry of parameters?.entries ?? []) {
    const id = entry.variableData?.value?.propRefValue?.defId
    if (entry.variableData?.dataType !== 'PROP_REF' || !id || !entry.variableField) continue
    if (!['VISIBLE', 'TEXT_DATA', 'OVERRIDDEN_SYMBOL_ID'].includes(entry.variableField)) continue
    const ref = { defID: structuredClone(id), componentPropNodeField: entry.variableField }
    const index = refs.findIndex(
      (candidate) => candidate.componentPropNodeField === entry.variableField
    )
    if (index === -1) refs.push(ref)
    else refs[index] = ref
  }
  if (refs.length) node.componentPropRefs = refs
}
