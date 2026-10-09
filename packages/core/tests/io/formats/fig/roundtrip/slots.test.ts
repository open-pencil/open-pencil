import { beforeAll, describe, expect, test } from 'bun:test'

import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'

import { FIXTURES } from '#core-tests/helpers/fig/fixtures'

import {
  exportFigFile,
  initCodec,
  parseFigFile,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { slotPropertyId } from '@open-pencil/scene-graph'

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
    // Card empty slot, Card default content, List, Panel, and Panel's two variants. Figma
    // links a variant's definition to the set's through `parentPropDefId`; the exporter
    // writes every variant definition in full, as it does for the other property types.
    expect(slots).toHaveLength(6)
    expect(slots.filter((definition) => definition.slotPropConfig)).toHaveLength(1)
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
