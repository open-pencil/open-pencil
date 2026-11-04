import { beforeAll, describe, expect, test } from 'bun:test'

import { FIXTURES } from '@open-pencil/test-support/paths'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import type { GUID } from '@open-pencil/kiwi/fig'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'

import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'

let original: SceneGraph
let reopened: SceneGraph
let records: NodeChange[]

type SlotRecord = NodeChange & {
  isSlotContent?: boolean
  componentPropDefs?: Array<{ type?: string; slotPropConfig?: unknown }>
  componentPropAssignments?: Array<{ varValue?: { dataType?: string } }>
  parameterConsumptionMap?: { entries?: Array<{ variableField?: string }> }
}

/** Every instance's slot content, by instance name, in layer order. */
function slotContents(graph: SceneGraph): Record<string, string[]> {
  const page = graph.getPages().find((candidate) => candidate.name === 'Slots fixture')
  const result: Record<string, string[]> = {}
  const names = (node: SceneNode): string[] =>
    graph
      .getChildren(node.id)
      .flatMap((child) => [child.name, ...names(child).map((name) => `${child.name}/${name}`)])
  for (const node of page ? graph.getChildren(page.id) : []) {
    if (node.type !== 'INSTANCE') continue
    const slot = graph.getChildren(node.id).find((child) => slotPropertyId(child))
    if (slot) result[node.name] = names(slot)
  }
  return result
}

beforeAll(async () => {
  await initCodec()
  original = await parseFigFile(await Bun.file(`${FIXTURES}/slots.fig`).arrayBuffer())
  // Without its archive the export encodes every record, which is what this checks.
  releaseFigPopulationWorker(original)
  const exported = await exportFigFile(original)
  expect(exported).not.toEqual(
    new Uint8Array(await Bun.file(`${FIXTURES}/slots.fig`).arrayBuffer())
  )
  records = parseFigBuffer(exported.slice().buffer).nodeChanges
  reopened = await parseFigFile(exported.slice().buffer)
})

describe('slots round trip', () => {
  test('every instance keeps its slot content', () => {
    const before = slotContents(original)
    expect(before['A filled']).toEqual(['Added text', 'Added rectangle'])
    expect(slotContents(reopened)).toEqual(before)
  })

  test('slot properties are written as SLOT definitions with their settings', () => {
    const definitions = records.flatMap((record) => (record as SlotRecord).componentPropDefs ?? [])
    const slots = definitions.filter((definition) => definition.type === 'SLOT')
    // Card empty slot, Card default content, List, and Panel.
    expect(slots).toHaveLength(4)
    expect(slots.filter((definition) => definition.slotPropConfig)).toHaveLength(1)
  })

  // As Figma saves a set: each variant copies the set's slot under an id of its own, linked by
  // `parentPropDefId`, its slot frame binds the copy, and an instance assigns its variant's copy.
  test("each of a set's variants links its own copy of the set's slot", () => {
    const id = (guid: unknown) => (guid ? guidToString(guid as GUID) : null)
    const byId = new Map(records.map((record) => [id(record.guid), record]))
    const set = records.find((record) => record.name === 'Panel' && record.isStateGroup)
    const content = (set as SlotRecord | undefined)?.componentPropDefs?.find(
      (definition) => definition.type === 'SLOT'
    ) as { id?: GUID } | undefined
    const variants = records.filter(
      (record) => record.type === 'SYMBOL' && id(record.parentIndex?.guid) === id(set?.guid)
    )
    expect(variants).toHaveLength(2)
    const copies = variants.map((variant) => {
      const [copy] = (variant.componentPropDefs ?? []) as { id?: GUID; parentPropDefId?: GUID }[]
      expect(id(copy?.parentPropDefId)).toBe(id(content?.id))
      return id(copy?.id)
    })
    expect(new Set(copies).size).toBe(2)
    for (const record of records) {
      const binding = (record as SlotRecord).parameterConsumptionMap?.entries?.find(
        (entry) => entry.variableField === 'SLOT_CONTENT_ID'
      ) as { variableData?: { value?: { propRefValue?: { defId?: GUID } } } } | undefined
      const variant = variants.find((item) => id(item.guid) === id(record.parentIndex?.guid))
      if (binding && variant)
        expect(id(binding.variableData?.value?.propRefValue?.defId)).toBe(
          copies[variants.indexOf(variant)]
        )
      if (record.type !== 'INSTANCE') continue
      const main = byId.get(id(record.symbolData?.symbolID))
      if (!main || !variants.includes(main)) continue
      const [assignment] = (record.componentPropAssignments ?? []) as { defID?: GUID }[]
      expect(id(assignment?.defID)).toBe(copies[variants.indexOf(main)])
    }
  })

  test('slot frames are bound through the parameter map', () => {
    const bound = records.filter((record) =>
      (record as SlotRecord).parameterConsumptionMap?.entries?.some(
        (entry) => entry.variableField === 'SLOT_CONTENT_ID'
      )
    )
    expect(bound.map((record) => record.name ?? '').toSorted()).toEqual([
      'Body',
      'Content',
      'Content',
      'Content',
      'Items'
    ])
  })

  test('assigned content is written as content frames on the internal canvas', () => {
    const internal = records.find((record) => record.type === 'CANVAS' && record.internalOnly)
    const frames = records.filter((record) => (record as SlotRecord).isSlotContent)
    const assignments = records.flatMap((record) =>
      ((record as SlotRecord).componentPropAssignments ?? []).filter(
        (assignment) => assignment.varValue?.dataType === 'SLOT_CONTENT_ID'
      )
    )
    // Nine assigned slots: the reset instance assigns nothing, and the cleared one is empty.
    expect(frames).toHaveLength(9)
    expect(assignments).toHaveLength(9)
    for (const frame of frames) {
      expect(frame.parentIndex?.guid).toEqual(internal?.guid)
      expect((frame as SlotRecord).parameterConsumptionMap).toBeUndefined()
    }
  })
})
