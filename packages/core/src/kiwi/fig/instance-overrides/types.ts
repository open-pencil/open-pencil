import type { GUID, NodeChange, VariableConsumptionEntry } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Matrix, Vector } from '@open-pencil/scene-graph/primitives'

import type { ProtectionMap } from './patches'

export interface VariableConsumptionMapFields {
  variableConsumptionMap?: { entries?: VariableConsumptionEntry[] }
  [key: string]: unknown
}

export interface SymbolOverride extends VariableConsumptionMapFields {
  guidPath?: { guids?: GUID[] }
  overriddenSymbolID?: GUID
  componentPropAssignments?: ComponentPropAssignment[]
}

export type SymbolOverrideFields = VariableConsumptionMapFields

export interface SymbolData {
  symbolID?: GUID
  symbolOverrides?: SymbolOverride[]
}

export interface ComponentPropRef {
  defID?: GUID
  componentPropNodeField: string
}

export type ComponentPropTextValue = string | { characters?: string }

export type ComponentPropValue = {
  boolValue?: boolean
  textValue?: ComponentPropTextValue
  textDataValue?: { characters?: string }
  guidValue?: GUID
}

export interface ComponentPropAssignment {
  defID?: GUID
  value: ComponentPropValue
  varValue?: {
    value?: {
      boolValue?: boolean
      textValue?: string
      textDataValue?: { characters?: string }
      symbolIdValue?: { guid?: GUID }
    }
  }
}

export interface DerivedSymbolOverride {
  guidPath?: { guids?: GUID[] }
  size?: Vector
  transform?: Matrix
  fontSize?: number
  lineHeight?: NodeChange['lineHeight']
  letterSpacing?: NodeChange['letterSpacing']
  strokeWeight?: number
  derivedTextData?: NodeChange['derivedTextData']
  fillGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
  strokeGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
}

export interface ComponentPropDef {
  id?: GUID
  name?: string
  initialValue?: ComponentPropValue
  type?: number
}

export interface InstanceNodeChange {
  type?: string
  name?: string
  guid?: GUID
  parentIndex?: { guid?: GUID }
  transform?: Matrix
  overrideKey?: GUID
  symbolData?: SymbolData
  componentPropRefs?: ComponentPropRef[]
  componentPropAssignments?: ComponentPropAssignment[]
  componentPropDefs?: ComponentPropDef[]
  styleType?: string
  fillPaints?: NodeChange['fillPaints']
  fillGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
  strokeGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
  strokeWeight?: number
  derivedSymbolData?: DerivedSymbolOverride[]
  key?: string
  version?: string
  userFacingVersion?: string
  variableDataValues?: NodeChange['variableDataValues']
}

/**
 * Shared state for override resolution.
 *
 * Built once in `populateAndApplyOverrides` and threaded through all
 * sub-functions. Avoids closure-based coupling (a single 700-line
 * function) while keeping the shared maps accessible.
 */
export interface OverrideContext {
  graph: SceneGraph
  changeMap: Map<string, InstanceNodeChange>
  guidToNodeId: Map<string, string>
  blobs: Uint8Array[]

  overrideKeyToGuid: Map<string, string>
  nodeIdToGuid: Map<string, string>
  propDefaults: Map<string, ComponentPropValue>
  propNames: Map<string, string>
  preComputedRoot: Map<string, string>
  componentIdRoot: Map<string, string>
  swappedInstances: Set<string>
  protectedFields: ProtectionMap
  /** Nodes whose kiwi NC has explicit property values (cornerRadius, visibility, etc.) */
  kiwiPropertyNodes: Set<string>
  /** Nodes whose Figma-derived geometry should not be overwritten by clone propagation. */
  geometryOverrideNodes: Set<string>
  /** When set, apply/populate expensive instance work only inside these already-imported nodes. */
  activeNodeIds?: Set<string>
}
