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
  origin: 'default' | 'assignment'
  /** Expansion depth of the owner that assigned the value; smaller is further out. */
  rank?: number
  /** Values this binding replaced, innermost first; claims may still address them. */
  superseded?: ComponentPropValue[]
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
  assignments: readonly ComponentPropAssignment[],
  rank?: number
): PropertyBinding[] {
  const result = structuredClone([...defaults])
  for (const assignment of assignments) {
    const value = assignmentValue(assignment)
    if (!assignment.defID || !value) continue
    const binding: PropertyBinding = {
      id: assignment.defID,
      value: structuredClone(value),
      origin: 'assignment',
      ...(rank === undefined ? {} : { rank })
    }
    const index = result.findIndex((entry) => sameId(entry.id, binding.id))
    if (index === -1) {
      result.push(binding)
      continue
    }
    const previous = result[index]
    result[index] = {
      ...binding,
      superseded: [...(previous.superseded ?? []), structuredClone(previous.value)]
    }
  }
  return result
}

export function componentBindings(source: NodeChange): PropertyBinding[] {
  const definitions = source.componentPropDefs as ComponentPropDef[] | undefined
  return (definitions ?? []).flatMap((definition) =>
    definition.id && definition.initialValue
      ? [
          {
            id: definition.id,
            value: structuredClone(definition.initialValue),
            origin: 'default'
          }
        ]
      : []
  )
}

export interface BoundPropertyClaim {
  definitionId: GUID
  field: 'visible' | 'textData' | 'symbolData'
  origin: PropertyBinding['origin']
}

export function bindSourceProperties(
  source: NodeChange,
  bindings: readonly PropertyBinding[],
  record?: (claim: BoundPropertyClaim, binding: PropertyBinding) => void
): NodeChange {
  const result = structuredClone(source)
  const refs = source.componentPropRefs as
    | (ComponentPropRef & { isDeleted?: boolean })[]
    | undefined
  for (const ref of refs ?? []) {
    if (!ref.defID || ref.isDeleted) continue
    const binding = bindings.find((entry) => sameId(entry.id, ref.defID as GUID))
    if (!binding) continue
    const { value, origin } = binding
    const claim = (field: BoundPropertyClaim['field']): void => {
      record?.({ definitionId: structuredClone(binding.id), field, origin }, binding)
    }
    if (ref.componentPropNodeField === 'VISIBLE' && value.boolValue !== undefined) {
      result.visible = value.boolValue
      claim('visible')
    } else if (ref.componentPropNodeField === 'TEXT_DATA') {
      const text =
        typeof value.textValue === 'string'
          ? value.textValue
          : (value.textValue?.characters ?? value.textDataValue?.characters)
      if (text !== undefined) {
        if (text !== result.textData?.characters) result.derivedTextData = undefined
        result.textData = { ...result.textData, characters: text }
        claim('textData')
      }
    } else if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID' && value.guidValue) {
      result.symbolData = { ...result.symbolData, symbolID: value.guidValue }
      claim('symbolData')
    }
  }
  return result
}
