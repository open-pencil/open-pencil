import type { GUID, NodeChange } from '#core/kiwi/binary/codec'
import type { SceneGraph } from '#core/scene-graph'
import type { Matrix, Vector } from '#core/types'

export interface SymbolOverride {
  guidPath?: { guids?: GUID[] }
  overriddenSymbolID?: GUID
  componentPropAssignments?: ComponentPropAssignment[]
  [key: string]: unknown
}

export interface SymbolData {
  symbolID?: GUID
  symbolOverrides?: SymbolOverride[]
}

export interface ComponentPropRef {
  defID?: GUID
  componentPropNodeField: string
}

export type ComponentPropValue = {
  boolValue?: boolean
  textValue?: string
  guidValue?: GUID
}

export interface ComponentPropAssignment {
  defID?: GUID
  value: ComponentPropValue
  varValue?: {
    value?: {
      boolValue?: boolean
      textValue?: string
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
  fillGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
  strokeGeometry?: Array<{ windingRule?: string; commandsBlob?: number }>
  derivedSymbolData?: DerivedSymbolOverride[]
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
  /** Nodes whose kiwi NC has explicit property values (cornerRadius, visibility, etc.) */
  kiwiPropertyNodes: Set<string>
  /** Nodes whose Figma-derived geometry should not be overwritten by clone propagation. */
  geometryOverrideNodes: Set<string>
  /** When set, apply/populate expensive instance work only inside these already-imported nodes. */
  activeNodeIds?: Set<string>
}
