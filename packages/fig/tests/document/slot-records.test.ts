import { expect, test } from 'bun:test'

import { materializeDocument, materializeFigArchive } from '#fig/document/materialize'

import { parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { readFixtureArrayBuffer } from '@open-pencil/test-support/paths'

/**
 * In `slots.fig`, "A filled" (14:38) assigns the content frame 14:42, holding "Added text"
 * (14:43) and "Added rectangle" (14:45), to the slot its component "Card empty slot" (14:15)
 * shows in the frame "Content" (14:17).
 */
const FILLED = '14:38'
const CONTENT = '14:42'

test('slot content keeps the records it was read from', () => {
  const { graph, sources } = materializeFigArchive(readFixtureArrayBuffer('slots.fig'))
  const instance = graph.getNode(FILLED)
  const frame = instance && graph.getChildren(instance.id).find((child) => child.name === 'Content')
  expect(sources.get(CONTENT)).toBe(frame?.id)
  expect(graph.getNode(sources.get('14:43') ?? '')?.name).toBe('Added text')
  expect(graph.getNode(sources.get('14:45') ?? '')?.name).toBe('Added rectangle')
  expect(instance?.source.fig.hiddenSlotAssignments).toEqual([])
})

/** The file with the component's slot frame no longer showing its slot. */
function withoutSlotFrame(): NodeChange[] {
  const records = parseFigBuffer(readFixtureArrayBuffer('slots.fig')).nodeChanges
  return records.map((record) =>
    record.guid && guidToString(record.guid) === '14:17'
      ? { ...record, parameterConsumptionMap: { entries: [] } }
      : record
  )
}

test('an instance keeps the slot assignment none of its layers shows', () => {
  const { graph, sources } = materializeDocument(withoutSlotFrame())
  const instance = graph.getNode(FILLED)
  expect(sources.has(CONTENT)).toBe(false)
  expect(instance?.source.fig.hiddenSlotAssignments).toMatchObject([
    {
      defID: { sessionID: 14, localID: 0 },
      varValue: { value: { slotContentIdValue: { guid: { sessionID: 14, localID: 42 } } } }
    }
  ])
})
