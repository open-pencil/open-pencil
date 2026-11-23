// Occurrence-scoped interpreter used by production FIG import.
export { interpretInstance, interpretComponent } from './interpret'
export type {
  InstanceOccurrence,
  InterpretInstanceOptions,
  InstancePathDiagnostic
} from './occurrence/types'
export { materializeInstance } from './materialize-instance'
export { materializeComponentClosure } from './component-closure'
export { linkInstanceSourceChildren, mapInstanceSourceChildren } from './source-children'
export { slotContentAssignedBy } from './slot-records'
export type { MaterializedInstance } from './materialize-instance'

/** The Kiwi codec types only `symbolID`, so the remaining symbol fields are read through these. */
export { derivedSymbolDataOf, symbolDataOf, symbolOverridesOf } from './types'

export type {
  ComponentPropAssignment,
  ComponentPropDef,
  ComponentPropRef,
  ComponentPropValue,
  DerivedSymbolOverride,
  SymbolData,
  SymbolOverride
} from './types'
