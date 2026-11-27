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
  /** An instance inside a component, and an instance of that component placed on a page. */
  const nested = (): { inner: NodeChange & { guid: GUID }; outer: NodeChange } => {
    for (const inner of records) {
      const holder = inner.type === 'INSTANCE' && inner.guid ? componentOf(inner) : undefined
      const outer = holder && instancesOf(holder).find((instance) => !componentOf(instance))
      if (outer && inner.guid) return { inner: { ...inner, guid: inner.guid }, outer }
    }
    throw new Error('No component holds an instance and is placed on a page')
  }
  return { componentOf, instancesOf, addOverride, nested }
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
    test(`match the TypeScript reader's on every layer of ${name}`, async () => {
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

  test('name the component a swap chooses though the file lacks it', async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { addOverride, nested } = documentOf(records)
      const { inner, outer } = nested()
      addOverride(outer, {
        guidPath: { guids: [inner.guid] },
        overriddenSymbolID: { sessionID: 999, localID: 999 }
      })
    })
    expectSameFields(pages)
  })

  test("name an instance swapped to an instance by that instance's name", async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { addOverride, nested, componentOf } = documentOf(records)
      const { inner, outer } = nested()
      const set = records.find((record) => record.isStateGroup === true && record.guid)
      const replacement = records.find(
        (record) =>
          record.type === 'INSTANCE' &&
          !componentOf(record) &&
          record.guid &&
          record !== outer &&
          record.name !== set?.name
      )
      if (!set?.guid || !replacement?.guid || !replacement.parentIndex)
        throw new Error('gold-preview.fig lacks a variant set or a placed instance')
      // An instance kept under a variant set stands in for the inner instance's component.
      replacement.parentIndex = { ...replacement.parentIndex, guid: set.guid }
      addOverride(outer, {
        guidPath: { guids: [inner.guid] },
        overriddenSymbolID: replacement.guid
      })
    })
    expectSameFields(pages)
  })

  test('keep the text a property binds when a scaled instance restores its own fields', async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { componentOf, nested } = documentOf(records)
      const { inner } = nested()
      const record = records.find((candidate) => candidate.guid === inner.guid)
      const holder = record && componentOf(record)
      const data = record && symbolDataOf(record)
      if (!record || !holder || !data) throw new Error('The nested instance is gone')
      const id: GUID = { sessionID: 7, localID: 8 }
      holder.componentPropDefs = [
        ...((holder.componentPropDefs ?? []) as object[]),
        { id, name: 'Label', type: 'TEXT', initialValue: { textValue: { characters: 'Bound' } } }
      ] as NodeChange['componentPropDefs']
      // A scaled instance saving text of its own that a property of its component binds.
      data.uniformScaleFactor = 2
      record.textData = { characters: 'Saved' }
      record.parameterConsumptionMap = {
        entries: [
          {
            variableField: 'TEXT_DATA',
            variableData: { dataType: 'PROP_REF', value: { propRefValue: { defId: id } } }
          }
        ]
      }
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

  test("give a text's ranges, a vector's regions, and a text style's left-out decoration their styles", async () => {
    const pages = await fieldsAfter('gold-preview.fig', (records) => {
      const { componentOf } = documentOf(records)
      const style = (kind: string) =>
        records.find(
          (record) => record.styleType === kind && (kind !== 'TEXT' || record.type === 'TEXT')
        )
      const fill = style('FILL')
      const text = style('TEXT')
      const placed = (type: string) =>
        records.find(
          (record) =>
            record.type === type && !record.styleType && !componentOf(record) && record.guid
        )
      const label = placed('TEXT')
      const vector = placed('VECTOR')
      if (
        !fill?.guid ||
        !text?.guid ||
        text.textDecoration ||
        !label?.textData ||
        !vector?.vectorData
      )
        throw new Error(
          'gold-preview.fig lacks a fill style, a plain text style, a text, or a vector'
        )
      // A range and a region naming the fill style, and a decorated text taking the text style.
      label.textData.styleOverrideTable = [{ styleID: 1, styleIdForFill: { guid: fill.guid } }]
      label.textDecoration = 'UNDERLINE'
      label.styleIdForText = { guid: text.guid }
      Object.assign(vector.vectorData, {
        styleOverrideTable: [{ styleID: 1, styleIdForFill: { guid: fill.guid } }]
      })
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
