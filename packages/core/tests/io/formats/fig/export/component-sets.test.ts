import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { deflateSync } from 'fflate'

import {
  FigmaAPI,
  type FigmaComponentSetNode,
} from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { compressFigDataSync, parseFigBuffer } from '@open-pencil/fig'
import type { GUID } from '@open-pencil/kiwi/fig'
import {
  getCompiledSchema,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseVariantName } from '@open-pencil/scene-graph/variant-name'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive/access'

setDefaultTimeout(60_000)

interface SavedDefinition {
  id?: GUID
  name?: string
  type?: string
  preferredValues?: unknown
}

interface SavedSpec {
  propDefId?: GUID
  value?: string
}

/** The Kiwi codec types these fields loosely; read the saved definitions and specs through here. */
const definitionsOf = (record: NodeChange) => (record.componentPropDefs ?? []) as SavedDefinition[]
const specsOf = (record: NodeChange) => (record.variantPropSpecs ?? []) as SavedSpec[]

/** The GUID the shadcn/ui kit's Checkbox gives its Interaction property: past 31 bits. */
const KIT_PROPERTY = { sessionID: 2583624281, localID: 1250876564 }

/**
 * A switch set saved as the shadcn/ui kit saves its sets: its variant property under a GUID
 * Figma made past 31 bits, no preferred values, and the values' order saved apart.
 */
async function kitStyleArchive(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  const figma = new FigmaAPI(source)
  const off = figma.createComponent()
  off.name = 'State=Off'
  const on = figma.createComponent()
  on.name = 'State=On'
  on.x = 100
  figma.combineAsVariants([off, on], figma.currentPage)
  const parsed = parseFigBuffer((await exportFigFile(source)).slice().buffer as ArrayBuffer)
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
  const kiwi = getCompiledSchema().encodeMessage({
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges: parsed.nodeChanges
  })
  return compressFigDataSync(
    deflateSync(getSchemaBytes()),
    kiwi,
    expectDefined(parsed.thumbnailPNG, 'thumbnail'),
    parsed.metaJSON ?? '{}',
    []
  )
}

/** The set's record: the one whose properties include a variant property. */
function setRecord(records: NodeChange[]): NodeChange {
  return expectDefined(
    records.find((record) => definitionsOf(record).some((def) => def.type === 'VARIANT')),
    'set record'
  )
}

const open = (bytes: Uint8Array) =>
  parseFigFile(bytes.slice().buffer as ArrayBuffer, { populate: 'first-page' })

/** Splits Invalid out as its own property and turns it on for one variant, as the kit adapts. */
function addInvalid(graph: SceneGraph): void {
  const figma = new FigmaAPI(graph)
  const set = expectDefined(
    figma.currentPage.findOne((node) => node.type === 'COMPONENT_SET') as FigmaComponentSetNode | null,
    'set'
  )
  set.addComponentProperty('Invalid', 'VARIANT', 'Off')
  const on = expectDefined(
    set.children.find((variant) => variant.name.startsWith('State=On')),
    'on variant'
  )
  on.name = 'State=On, Invalid=On'
}

/** Each variant's saved specs, by property name, and its name's values. */
function savedVariants(bytes: Uint8Array) {
  const records = parseFigBuffer(bytes.slice().buffer as ArrayBuffer).nodeChanges
  const set = setRecord(records)
  const names = new Map(
    definitionsOf(set).map((definition) => [
      guidToString(expectDefined(definition.id, 'definition id')),
      definition.name
    ])
  )
  const setGuid = guidToString(expectDefined(set.guid, 'set guid'))
  const variants = records.filter(
    (record: NodeChange) =>
      record.parentIndex?.guid && guidToString(record.parentIndex.guid) === setGuid
  )
  return {
    set,
    variants: variants.map((record) => ({
      name: parseVariantName(record.name ?? ''),
      specs: Object.fromEntries(
        specsOf(record).map((spec) => [
          names.get(guidToString(expectDefined(spec.propDefId, 'spec property'))) ?? 'unknown',
          spec.value
        ])
      )
    }))
  }
}

// Without the flag Figma (desktop 126) reads the set as a plain frame of loose components, and
// an instance of one variant has no properties; it lists the values in the saved order.
test('a set made in OpenPencil is written as a set Figma reads', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const variants = ['State=Off', 'State=On'].map((name, index) => {
    const component = figma.createComponent()
    component.name = name
    component.x = index * 100
    return component
  })
  figma.combineAsVariants(variants, figma.currentPage)
  const saved = await exportFigFile(graph)
  const set = setRecord(parseFigBuffer(saved.slice().buffer as ArrayBuffer).nodeChanges)
  expect(set.isStateGroup).toBe(true)
  expect(set.stateGroupPropertyValueOrders).toEqual([{ property: 'State', values: ['Off', 'On'] }])
})

describe('saving variants edited in a set read from a .fig', () => {
  test('writes each variant’s values under its set’s properties', async () => {
    const bytes = await kitStyleArchive()
    const patchedGraph = await open(bytes)
    addInvalid(patchedGraph)
    const patched = await exportFigFile(patchedGraph)
    const fullGraph = await open(bytes)
    addInvalid(fullGraph)
    releaseFigArchive(fullGraph)
    const full = await exportFigFile(fullGraph)

    for (const saved of [patched, full]) {
      const { set, variants } = savedVariants(saved)
      // Every spec names one of the set's properties and agrees with the variant's name.
      expect(variants.map((variant) => variant.specs)).toEqual(
        variants.map((variant) => variant.name)
      )
      expect(variants.map((variant) => variant.name)).toEqual([
        { State: 'Off', Invalid: 'Off' },
        { State: 'On', Invalid: 'On' }
      ])
      // Figma lists a set's values in this order, and reads a frame without the flag as a plain
      // frame (desktop 126): the order is written again for the properties the set has now.
      expect(set.isStateGroup).toBe(true)
      expect(set.stateGroupPropertyValueOrders).toEqual([
        { property: 'State', values: ['On', 'Off'] },
        { property: 'Invalid', values: ['Off', 'On'] }
      ])
      const reopened = await open(saved)
      const values = [...reopened.nodes.values()]
        .filter((node) => node.type === 'COMPONENT')
        .map((node) => node.componentPropertyValues)
      expect(values).toEqual(variants.map((variant) => variant.name))
    }
    // Written into the archive, the set keeps the property's GUID the untouched records use.
    const { set } = savedVariants(patched)
    const state = definitionsOf(set).find((definition) => definition.name === 'State')
    expect(state?.id).toEqual(KIT_PROPERTY)
  })
})
