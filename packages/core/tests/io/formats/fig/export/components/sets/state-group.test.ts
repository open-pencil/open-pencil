import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { open } from '#core-tests/helpers/fig/archive'
import {
  definitionsOf,
  KIT_PROPERTY,
  kitStyleArchive,
  setRecord,
  specsOf
} from '#core-tests/helpers/fig/component-sets'

import { FigmaAPI, type FigmaComponentSetNode } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseVariantName } from '@open-pencil/scene-graph/variant-name'
import { expectDefined } from '@open-pencil/test-support/assert'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive/access'

setDefaultTimeout(60_000)

/** Splits Invalid out as its own property and turns it on for one variant, as the kit adapts. */
function addInvalid(graph: SceneGraph): void {
  const figma = new FigmaAPI(graph)
  const set = expectDefined(
    figma.currentPage.findOne(
      (node) => node.type === 'COMPONENT_SET'
    ) as FigmaComponentSetNode | null,
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
