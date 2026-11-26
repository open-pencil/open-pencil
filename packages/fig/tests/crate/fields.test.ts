import { describe, expect, test } from 'bun:test'

import { readFieldsWithBoth } from '#fig-tests/helpers/fig-crate'
import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { parseFigBuffer } from '#fig/archive/index'
import { symbolDataOf, type SymbolOverride } from '#fig/instance-overrides/types'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { readFixtureArrayBuffer, readFixtureBytes } from '@open-pencil/test-support/paths'

const FIXTURES = [
  'gold-preview.fig',
  'slots.fig',
  'variable-override-precedence.fig',
  'circle-text.fig'
]

/** The unset GUID, which an instance claims to clear a style or a collection's mode with. */
const UNSET: GUID = { sessionID: 0xffffffff, localID: 0xffffffff }

/** Both readers' fields for a fixture whose records `edit` changed first. */
async function fieldsAfter(fixture: string, edit: (records: NodeChange[]) => void) {
  const records = parseFigBuffer(readFixtureArrayBuffer(fixture)).nodeChanges
  edit(records)
  return readFieldsWithBoth(new Uint8Array(await figArchiveOf(records)))
}

function expectSameFields(pages: Awaited<ReturnType<typeof readFieldsWithBoth>>): void {
  for (const { id, differences } of pages)
    expect({ id, differences }).toEqual({ id, differences: [] })
  expect(pages.reduce((sum, page) => sum + page.values, 0)).toBeGreaterThan(0)
}

/** Lookups over one document's records. */
function documentOf(records: NodeChange[]) {
  const byId = new Map(
    records.flatMap((record) => (record.guid ? [[guidToString(record.guid), record] as const] : []))
  )
  const parent = (record: NodeChange) =>
    record.parentIndex?.guid && byId.get(guidToString(record.parentIndex.guid))
  /** The component a layer belongs to: its nearest component ancestor. */
  const componentOf = (record: NodeChange): NodeChange | undefined => {
    for (let at = parent(record); at; at = parent(at)) if (at.type === 'SYMBOL') return at
    return undefined
  }
  const instancesOf = (component: NodeChange) =>
    records.filter(
      (record) =>
        record.type === 'INSTANCE' &&
        record.symbolData?.symbolID &&
        component.guid &&
        guidToString(record.symbolData.symbolID) === guidToString(component.guid)
    )
  const addOverride = (instance: NodeChange, override: SymbolOverride) => {
    const data = symbolDataOf(instance)
    if (!data) throw new Error('An instance without symbol data')
    data.symbolOverrides = [...(data.symbolOverrides ?? []), override]
  }
  return { componentOf, instancesOf, addOverride }
}

/** The definition a layer's field binds through its parameter map. */
function boundDefinition(record: NodeChange, field: string): GUID | undefined {
  const entry = record.parameterConsumptionMap?.entries?.find(
    (candidate) =>
      candidate.variableField === field && candidate.variableData?.dataType === 'PROP_REF'
  )
  return entry?.variableData?.value?.propRefValue?.defId
}

describe('field values from the Rust reader', () => {
  for (const name of FIXTURES) {
    test(`match the TypeScript reader's without styles on every layer of ${name}`, async () => {
      expectSameFields(await readFieldsWithBoth(readFixtureBytes(name)))
    })
  }

  test("take an outer instance's assignment over an inner instance's explicit value", async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { componentOf, instancesOf, addOverride } = documentOf(records)
      for (const layer of records) {
        const definition = boundDefinition(layer, 'VISIBLE')
        const component = definition && componentOf(layer)
        if (!definition || !component || !layer.guid) continue
        for (const inner of instancesOf(component)) {
          const holder = componentOf(inner)
          const outer = holder && instancesOf(holder).find((instance) => !componentOf(instance))
          if (!outer || !inner.guid) continue
          // The inner instance hides the layer; the outer one assigns the property showing it.
          addOverride(inner, { guidPath: { guids: [layer.guid] }, visible: false })
          addOverride(outer, {
            guidPath: { guids: [inner.guid] },
            componentPropAssignments: [{ defID: definition, value: { boolValue: true } }]
          })
          return
        }
      }
      throw new Error('gold-preview.fig nests no instance whose layer binds a visible property')
    })
    expectSameFields(pages)
  })

  test("drop a collection's mode an instance clears", async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { componentOf } = documentOf(records)
      const instance = records.find((record) => record.type === 'INSTANCE' && !componentOf(record))
      if (!instance) throw new Error('gold-preview.fig places no instance on a page')
      instance.variableModeBySetMap = {
        entries: [{ variableSetID: { guid: { sessionID: 7, localID: 7 } } }]
      }
    })
    expectSameFields(pages)
  })

  test('write a text property default into the text it binds', async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { componentOf, instancesOf } = documentOf(records)
      const text = records.find((record) => {
        const component = record.type === 'TEXT' && componentOf(record)
        return component && instancesOf(component).some((instance) => !componentOf(instance))
      })
      const component = text && componentOf(text)
      if (!text || !component) throw new Error('gold-preview.fig places no component holding text')
      // The component gains a text property, which the text binds.
      const id: GUID = { sessionID: 7, localID: 7 }
      component.componentPropDefs = [
        ...((component.componentPropDefs ?? []) as object[]),
        { id, name: 'Label', type: 'TEXT', initialValue: { textValue: { characters: 'Edited' } } }
      ] as NodeChange['componentPropDefs']
      text.parameterConsumptionMap = {
        entries: [
          ...(text.parameterConsumptionMap?.entries ?? []),
          {
            variableField: 'TEXT_DATA',
            variableData: { dataType: 'PROP_REF', value: { propRefValue: { defId: id } } }
          }
        ]
      }
    })
    expectSameFields(pages)
  })

  test('complete a claim clearing a style from the record of the instance that claims it', async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { componentOf } = documentOf(records)
      const placed = records.filter((record) => record.type === 'INSTANCE' && !componentOf(record))
      const [outer, inner] = placed
      const innerData = inner && symbolDataOf(inner)
      if (!outer?.symbolData || !inner?.guid || !innerData?.symbolID)
        throw new Error('gold-preview.fig places fewer than two instances')
      // The outer instance expands the inner one, whose root claim clears its fill style.
      outer.symbolData.symbolID = inner.guid
      outer.fillPaints = undefined
      outer.styleIdForFill = undefined
      inner.fillPaints = [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
      ]
      innerData.symbolOverrides = [
        ...(innerData.symbolOverrides ?? []),
        { guidPath: { guids: [innerData.symbolID] }, styleIdForFill: { guid: UNSET } }
      ]
    })
    expectSameFields(pages)
  })

  test("complete a claim clearing a text style with the layer's own text fields", async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { componentOf, instancesOf, addOverride } = documentOf(records)
      for (const text of records) {
        const component = text.type === 'TEXT' && componentOf(text)
        const instance = component && instancesOf(component).find((at) => !componentOf(at))
        if (!instance || !text.guid) continue
        addOverride(instance, { guidPath: { guids: [text.guid] }, styleIdForText: { guid: UNSET } })
        return
      }
      throw new Error('gold-preview.fig places no component holding text')
    })
    expectSameFields(pages)
  })
})
