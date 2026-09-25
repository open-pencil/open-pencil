import type { GUID, NodeChange, VariableConsumptionEntry } from '@open-pencil/kiwi/fig/codec'
import type { Matrix, Vector } from '@open-pencil/scene-graph/primitives'

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
  uniformScaleFactor?: number
  symbolID?: GUID
  symbolOverrides?: SymbolOverride[]
}

/** The Kiwi codec types only `symbolID`; the remaining symbol fields are read through here. */
export function symbolDataOf(record: NodeChange): SymbolData | undefined {
  return record.symbolData as SymbolData | undefined
}

export function symbolOverridesOf(record: NodeChange): readonly SymbolOverride[] {
  return symbolDataOf(record)?.symbolOverrides ?? []
}

export function uniformScaleOf(record: NodeChange): number {
  return symbolDataOf(record)?.uniformScaleFactor ?? 1
}

/** A record's saved override payloads are partial records; visit the record and all of them. */
export function forEachOverrideRecord(
  record: NodeChange,
  visit: (record: NodeChange, override?: SymbolOverride) => void,
  override?: SymbolOverride
): void {
  visit(record, override)
  for (const nested of symbolOverridesOf(record))
    forEachOverrideRecord(nested as NodeChange, visit, nested)
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
  value?: ComponentPropValue
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
  vectorData?: NodeChange['vectorData']
  fillGeometry?: NodeChange['fillGeometry']
  strokeGeometry?: NodeChange['strokeGeometry']
}

export interface ComponentPropDef {
  id?: GUID
  name?: string
  initialValue?: ComponentPropValue
  type?: number
}
