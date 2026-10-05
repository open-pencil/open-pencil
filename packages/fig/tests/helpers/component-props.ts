import type { ComponentPropDef, ComponentPropRef } from '#fig/instance-overrides/types'

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
