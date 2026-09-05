import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'

import type {
  ComponentPropAssignment,
  ComponentPropDef,
  ComponentPropRef,
  ComponentPropValue
} from './types'

/** Values belong to one component expansion, never a document-wide property map. */
export interface PropertyBinding {
  id: GUID
  value: ComponentPropValue
}

function sameId(a: GUID, b: GUID): boolean {
  return a.sessionID === b.sessionID && a.localID === b.localID
}

function assignmentValue(assignment: ComponentPropAssignment): ComponentPropValue | undefined {
  const value = assignment.value
  if (
    value &&
    (value.boolValue !== undefined ||
      value.textValue !== undefined ||
      value.guidValue !== undefined ||
      value.textDataValue !== undefined)
  )
    return value
  const variable = assignment.varValue?.value
  if (variable?.symbolIdValue?.guid) return { guidValue: variable.symbolIdValue.guid }
  if (variable?.boolValue !== undefined) return { boolValue: variable.boolValue }
  if (variable?.textValue !== undefined) return { textValue: variable.textValue }
  if (variable?.textDataValue !== undefined) return { textDataValue: variable.textDataValue }
  return undefined
}

export function instanceBindings(
  defaults: readonly PropertyBinding[],
  assignments: readonly ComponentPropAssignment[]
): PropertyBinding[] {
  const result = structuredClone([...defaults])
  for (const assignment of assignments) {
    const value = assignmentValue(assignment)
    if (!assignment.defID || !value) continue
    const binding = { id: assignment.defID, value: structuredClone(value) }
    const index = result.findIndex((entry) => sameId(entry.id, binding.id))
    if (index === -1) result.push(binding)
    else result[index] = binding
  }
  return result
}

export function componentBindings(source: NodeChange): PropertyBinding[] {
  const definitions = source.componentPropDefs as ComponentPropDef[] | undefined
  return (definitions ?? []).flatMap((definition) =>
    definition.id && definition.initialValue
      ? [{ id: definition.id, value: structuredClone(definition.initialValue) }]
      : []
  )
}

export function fieldsBoundByAssignments(
  source: NodeChange,
  assignments: readonly ComponentPropAssignment[]
): ReadonlySet<string> {
  const bindings = instanceBindings([], assignments)
  const refs = source.componentPropRefs as
    | (ComponentPropRef & { isDeleted?: boolean })[]
    | undefined
  const fields = new Set<string>()
  for (const ref of refs ?? []) {
    const id = ref.defID
    if (!id || ref.isDeleted || !bindings.some((binding) => sameId(binding.id, id))) continue
    if (ref.componentPropNodeField === 'TEXT_DATA') fields.add('textData')
    if (ref.componentPropNodeField === 'VISIBLE') fields.add('visible')
    if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID') fields.add('symbolData')
  }
  return fields
}

export function bindSourceProperties(
  source: NodeChange,
  bindings: readonly PropertyBinding[]
): NodeChange {
  const result = structuredClone(source)
  const refs = source.componentPropRefs as
    | (ComponentPropRef & { isDeleted?: boolean })[]
    | undefined
  for (const ref of refs ?? []) {
    if (!ref.defID || ref.isDeleted) continue
    const value = bindings.find((entry) => sameId(entry.id, ref.defID as GUID))?.value
    if (!value) continue
    if (ref.componentPropNodeField === 'VISIBLE' && value.boolValue !== undefined) {
      result.visible = value.boolValue
    } else if (ref.componentPropNodeField === 'TEXT_DATA') {
      const text =
        typeof value.textValue === 'string'
          ? value.textValue
          : (value.textValue?.characters ?? value.textDataValue?.characters)
      if (text !== undefined) result.textData = { ...result.textData, characters: text }
    } else if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID' && value.guidValue) {
      result.symbolData = { ...result.symbolData, symbolID: value.guidValue }
    }
  }
  return result
}
