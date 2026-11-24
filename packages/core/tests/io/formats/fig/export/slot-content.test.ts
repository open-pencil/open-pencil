import { expect, test } from 'bun:test'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

import { savedSlotContentFor } from '#core/io/formats/fig/export/slot-content'

const CANVAS = guid(2)

/** A record assigning the slot content frame `content`, as an instance's slot property does. */
function assigning(localID: number, content: number, parent = 1): NodeChange {
  return {
    guid: guid(localID),
    type: 'INSTANCE',
    parentIndex: { guid: guid(parent), position: '0' },
    componentPropAssignments: [
      {
        defID: guid(99),
        varValue: { value: { slotContentIdValue: { guid: guid(content) } } }
      }
    ]
  } as NodeChange
}

function frame(localID: number, extra: Partial<NodeChange> = {}): NodeChange {
  return {
    guid: guid(localID),
    type: 'FRAME',
    isSlotContent: true,
    parentIndex: { guid: CANVAS, position: 'saved' },
    ...extra
  }
}

function keep(written: NodeChange[], saved: NodeChange[], savedBlobs: Uint8Array[] = []) {
  const blobs = [new Uint8Array([9])]
  let position = 0
  const records = savedSlotContentFor(
    written,
    { records: saved, blobs: savedBlobs },
    CANVAS,
    () => `${position++}`,
    blobs
  )
  return { records, blobs }
}

test('keeps content that kept content assigns, wherever the file saved it', () => {
  // 20 is assigned only by 31, which sits in 10, which a written record assigns.
  const saved = [frame(20), frame(10), assigning(31, 20, 10), frame(40)]
  const { records } = keep([assigning(5, 10)], saved)
  expect(records.map((record) => record.guid?.localID)).toEqual([10, 31, 20])
  expect(records[2].parentIndex).toEqual({ guid: CANVAS, position: '1' })
})

test('keeps content that an override assigns, however deep it is nested', () => {
  // The codec types only `symbolID`; Figma nests overrides of nested instances.
  const overrides = [
    {
      guidPath: { guids: [guid(51)] },
      symbolData: {
        symbolOverrides: [{ guidPath: { guids: [guid(52)] }, ...assigning(0, 20) }]
      }
    }
  ]
  const nested: NodeChange = {
    guid: guid(31),
    type: 'INSTANCE',
    parentIndex: { guid: guid(10), position: '0' },
    ...({ symbolData: { symbolID: guid(50), symbolOverrides: overrides } } as Partial<NodeChange>)
  }
  const { records } = keep([assigning(5, 10)], [frame(10), nested, frame(20)])
  expect(records.map((record) => record.guid?.localID)).toEqual([10, 31, 20])
})

test('kept content cites its blobs in the blobs the save writes', () => {
  const geometry = (index: number) => [{ windingRule: 'NONZERO', commandsBlob: index }]
  const saved = [
    frame(10, { fillGeometry: geometry(1) } as Partial<NodeChange>),
    {
      ...frame(11, { strokeGeometry: geometry(0) } as Partial<NodeChange>),
      parentIndex: { guid: guid(10), position: '0' }
    }
  ]
  const { records, blobs } = keep([assigning(5, 10)], saved, [
    new Uint8Array([7]),
    new Uint8Array([8])
  ])
  expect(blobs).toEqual([new Uint8Array([9]), new Uint8Array([8]), new Uint8Array([7])])
  expect(records.map((record) => record.fillGeometry ?? record.strokeGeometry)).toEqual([
    geometry(1),
    geometry(2)
  ])
})
