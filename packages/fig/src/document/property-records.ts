import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import type { ComponentPropAssignment, ComponentPropRef } from '../instance-overrides/types'

interface PropertyDefinition {
  initialValue?: ComponentPropAssignment['value']
  varValue?: ComponentPropAssignment['varValue']
}

const BOUND_FIELDS = new Set(['VISIBLE', 'TEXT_DATA', 'OVERRIDDEN_SYMBOL_ID', 'SLOT_CONTENT_ID'])

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

/**
 * Figma binds a layer to component properties through its parameter map alone: a legacy
 * `componentPropRefs` entry draws nothing, whether or not the map repeats it (live-verified), so
 * the references are the map's.
 */
export function normalizeComponentPropertyRecords(node: NodeChange): void {
  normalizeDefaults(node)
  const refs: ComponentPropRef[] = []
  for (const entry of node.parameterConsumptionMap?.entries ?? []) {
    const id = entry.variableData?.value?.propRefValue?.defId
    if (entry.variableData?.dataType !== 'PROP_REF' || !id || !entry.variableField) continue
    if (!BOUND_FIELDS.has(entry.variableField)) continue
    refs.push({ defID: structuredClone(id), componentPropNodeField: entry.variableField })
  }
  if (refs.length) node.componentPropRefs = refs
  else Reflect.deleteProperty(node, 'componentPropRefs')
}
