// Occurrence-scoped interpreter used by production FIG import.
export { interpretInstance, interpretComponent } from './interpret'
export type {
  InstanceOccurrence,
  InterpretInstanceOptions,
  InstancePathDiagnostic
} from './interpret'
export { materializeInstance } from './materialize-instance'
export { materializeComponentClosure } from './component-closure'
export { linkInstanceSourceChildren, mapInstanceSourceChildren } from './source-children'
export type { MaterializedInstance } from './materialize-instance'

export type {
  ComponentPropAssignment,
  ComponentPropDef,
  ComponentPropRef,
  ComponentPropValue,
  DerivedSymbolOverride,
  SymbolData,
  SymbolOverride
} from './types'
