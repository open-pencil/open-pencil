import type { ComponentPropDef, ComponentPropRef } from '#fig/instance-overrides/types'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

/** Export writes preferred values onto a definition; the interpreter never reads them. */
export interface ExportedComponentPropDef extends ComponentPropDef {
  preferredValues?: {
    instanceSwapValues?: Array<{ type?: string; key?: string; version?: string }>
  }
}

/** The Kiwi codec types node fields as `unknown`; read exported definitions through here. */
export function componentPropDefsOf(record: NodeChange): ExportedComponentPropDef[] | undefined {
  return record.componentPropDefs as ExportedComponentPropDef[] | undefined
}

export function componentPropRefsOf(record: NodeChange): ComponentPropRef[] | undefined {
  return record.componentPropRefs as ComponentPropRef[] | undefined
}

const BOUND_FIELD_TYPES = {
  VISIBLE: 'BOOLEAN',
  TEXT_DATA: 'STRING',
  OVERRIDDEN_SYMBOL_ID: 'SYMBOL_ID',
  SLOT_CONTENT_ID: 'SLOT_CONTENT_ID'
} as const

/** A layer's binding to a component property, written as Figma does: in its parameter map. */
export function propertyBinding(
  defId: GUID,
  field: keyof typeof BOUND_FIELD_TYPES
): Pick<NodeChange, 'parameterConsumptionMap'> {
  return {
    parameterConsumptionMap: {
      entries: [
        {
          variableField: field,
          variableData: {
            value: { propRefValue: { defId } },
            dataType: 'PROP_REF',
            resolvedDataType: BOUND_FIELD_TYPES[field]
          }
        }
      ]
    }
  }
}
