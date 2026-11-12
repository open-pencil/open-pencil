import { FigmaAPI, type FigmaRectangleNode } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import type { GUID } from '@open-pencil/kiwi/fig'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { encodeArchive } from './archive'

export interface SavedDefinition {
  id?: GUID
  name?: string
  type?: string
  preferredValues?: unknown
}

export interface SavedSpec {
  propDefId?: GUID
  value?: string
}

/** The Kiwi codec types these fields loosely; read the saved definitions and specs through here. */
export const definitionsOf = (record: NodeChange) =>
  (record.componentPropDefs ?? []) as SavedDefinition[]
export const specsOf = (record: NodeChange) => (record.variantPropSpecs ?? []) as SavedSpec[]

/** The GUID the shadcn/ui kit's Checkbox gives its Interaction property: past 31 bits. */
export const KIT_PROPERTY = { sessionID: 2583624281, localID: 1250876564 }

/**
 * A switch set saved as the shadcn/ui kit saves its sets: its variant property under a GUID
 * Figma made past 31 bits, no preferred values, and the values' order saved apart.
 */
export async function kitStyleArchive(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  const figma = new FigmaAPI(source)
  const off = figma.createComponent()
  off.name = 'State=Off'
  const on = figma.createComponent()
  on.name = 'State=On'
  on.x = 100
  figma.combineAsVariants([off, on], figma.currentPage)
  const parsed = parseFigBuffer((await exportFigFile(source)).slice().buffer)
  const set = setRecord(parsed.nodeChanges)
  set.isStateGroup = true
  const [definition] = definitionsOf(set)
  const saved = guidToString(expectDefined(definition.id, 'definition id'))
  definition.id = KIT_PROPERTY
  delete definition.preferredValues
  set.stateGroupPropertyValueOrders = [{ property: 'State', values: ['On', 'Off'] }]
  for (const record of parsed.nodeChanges)
    for (const spec of specsOf(record))
      if (spec.propDefId && guidToString(spec.propDefId) === saved) spec.propDefId = KIT_PROPERTY
  return encodeArchive(parsed)
}

/** The set's record: the one whose properties include a variant property. */
export function setRecord(records: NodeChange[]): NodeChange {
  return expectDefined(
    records.find((record) => definitionsOf(record).some((def) => def.type === 'VARIANT')),
    'set record'
  )
}

export interface SavedCopy {
  id?: GUID
  parentPropDefId?: GUID
}

export const guidOf = (guid: unknown) => (guid ? guidToString(guid as GUID) : null)

/** The GUID a record's parameter map binds a field to. */
export function boundGuid(record: NodeChange, field: string): string | null {
  const entries = (record.parameterConsumptionMap?.entries ?? []) as {
    variableField?: string
    variableData?: { value?: { propRefValue?: { defId?: GUID } } }
  }[]
  const entry = entries.find((item) => item.variableField === field)
  return guidOf(entry?.variableData?.value?.propRefValue?.defId)
}

/** A set's variants' records, in order. */
export function variantRecords(records: NodeChange[], set: NodeChange): NodeChange[] {
  const setGuid = guidOf(set.guid)
  return records.filter((record) => guidOf(record.parentIndex?.guid) === setGuid)
}

/**
 * A Size set whose variants each show a dot bound to its Show dot boolean, and an instance of
 * the large one with the dot turned off.
 */
export async function dotSet(): Promise<SceneGraph> {
  await initCodec()
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const dots: FigmaRectangleNode[] = []
  const variants = ['Size=Small', 'Size=Large'].map((name, index) => {
    const component = figma.createComponent()
    component.name = name
    component.x = index * 100
    const dot = figma.createRectangle()
    dot.name = 'Dot'
    component.appendChild(dot)
    dots.push(dot)
    return component
  })
  const set = figma.combineAsVariants(variants, figma.currentPage)
  const key = set.addComponentProperty('Show dot', 'BOOLEAN', true)
  for (const dot of dots) dot.componentPropertyReferences = { visible: key }
  const instance = expectDefined(variants[1], 'large').createInstance()
  instance.setProperties({ [key]: false })
  return graph
}

/** Each variant's copies, by the name of the set property each copies, and its dot's binding. */
export function savedCopies(records: NodeChange[]) {
  const set = setRecord(records)
  const names = new Map(
    definitionsOf(set).map((definition) => [guidOf(definition.id), definition.name])
  )
  return variantRecords(records, set).map((variant) => {
    const dot = records.find((record) => guidOf(record.parentIndex?.guid) === guidOf(variant.guid))
    return {
      copies: Object.fromEntries(
        ((variant.componentPropDefs ?? []) as SavedCopy[]).map((copy) => [
          names.get(guidOf(copy.parentPropDefId)),
          guidOf(copy.id)
        ])
      ),
      dot: dot ? boundGuid(dot, 'VISIBLE') : null
    }
  })
}
