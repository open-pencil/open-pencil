// Occurrence-scoped interpreter used by production FIG import.
export { interpretInstance } from './interpret'
export type {
  InstanceOccurrence,
  InterpretInstanceOptions,
  InstancePathDiagnostic
} from './interpret'
export { materializeInstance } from './materialize-instance'
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
