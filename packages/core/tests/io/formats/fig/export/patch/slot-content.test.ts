import { beforeAll, expect, setDefaultTimeout, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer, patchFigArchive, readStreamBytes } from '@open-pencil/fig'
import type { GUID } from '@open-pencil/kiwi/fig'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { readFixtureArrayBuffer } from '@open-pencil/test-support/paths'

setDefaultTimeout(120_000)

beforeAll(async () => {
  await initCodec()
})

/**
 * In `slots.fig`, "A filled" (14:38) assigns the content frame 14:42, holding "Added text"
 * (14:43) and "Added rectangle" (14:45), to the slot its component shows in "Content" (14:17).
 */
const CONTENT = ['14:42', '14:43', '14:45']

function recordsOf(bytes: ArrayBuffer | Uint8Array): Map<string, NodeChange> {
  const buffer = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes
  return new Map(
    parseFigBuffer(buffer).nodeChanges.flatMap((record) =>
      record.guid ? [[guidToString(record.guid), record]] : []
    )
  )
}

interface SlotAssignment {
  defID?: GUID
  varValue?: { value?: { slotContentIdValue?: { guid?: GUID } } }
}

/** Every slot content frame the records assign, by the assigning record and property. */
function slotAssignments(records: ReadonlyMap<string, NodeChange>): string[] {
  return [...records].flatMap(([id, record]) =>
    ((record.componentPropAssignments ?? []) as SlotAssignment[]).flatMap((assignment) => {
      const guid = assignment.varValue?.value?.slotContentIdValue?.guid
      return guid ? [`${id}:${guidToString(assignment.defID ?? guid)}=${guidToString(guid)}`] : []
    })
  )
}

function child(graph: SceneGraph, parent: SceneNode | undefined, name: string): SceneNode {
  return expectDefined(graph.getChildren(parent?.id ?? '').find((node) => node.name === name))
}

test('an edit inside slot content writes only that record', async () => {
  const bytes = readFixtureArrayBuffer('slots.fig')
  const graph = await parseFigFile(bytes.slice(0))
  const frame = child(graph, graph.getNode('14:38'), 'Content')
  graph.updateNode(child(graph, frame, 'Added text').id, { name: 'Renamed text' })
  const before = recordsOf(bytes)
  const after = recordsOf(await exportFigFile(graph))
  const changed = [...after].filter(([id, record]) => !Bun.deepEquals(before.get(id), record))
  expect(changed.map(([id, record]) => [id, record.name])).toEqual([['14:43', 'Renamed text']])
})

test('a whole write keeps slot content under the GUIDs the file gave it', async () => {
  const bytes = readFixtureArrayBuffer('slots.fig')
  const graph = await parseFigFile(bytes.slice(0))
  // The content frame's own record sits on the internal canvas, which only a whole write places.
  graph.updateNode(child(graph, graph.getNode('14:38'), 'Content').id, { opacity: 0.5 })
  const before = recordsOf(bytes)
  const after = recordsOf(await exportFigFile(graph))
  for (const id of CONTENT) expect(after.get(id)?.name).toBe(before.get(id)?.name)
  expect(after.get('14:42')?.opacity).toBe(0.5)
  expect(slotAssignments(after)).toEqual(slotAssignments(before))
})

/** `slots.fig` with the component's frame no longer showing its slot, as a variant without it. */
async function withHiddenSlot(): Promise<ArrayBuffer> {
  const bytes = readFixtureArrayBuffer('slots.fig')
  const frame = expectDefined(recordsOf(bytes).get('14:17'))
  const patched = await readStreamBytes(
    patchFigArchive(
      bytes,
      {
        records: [{ ...frame, parameterConsumptionMap: { entries: [] } }],
        blobs: [],
        removed: [],
        replaceVariables: false
      },
      { thumbnailPNG: new Uint8Array(), metaJSON: '{}', images: [] }
    )
  )
  return patched.slice().buffer
}

test('a whole write keeps slot content that no layer shows, and its assignment', async () => {
  const bytes = await withHiddenSlot()
  const graph = await parseFigFile(bytes.slice(0))
  const filled = expectDefined(graph.getNode('14:38'))
  expect(graph.getChildren(child(graph, filled, 'Content').id)).toEqual([])
  // Another instance's slot frame takes the whole write.
  const modified = expectDefined(
    [...graph.nodes.values()].find((node) => node.name === 'B modified')
  )
  const slot = expectDefined(
    graph.getChildren(modified.id).find((node) => node.componentPropertyReferences.length > 0)
  )
  graph.updateNode(slot.id, { opacity: 0.5 })
  const before = recordsOf(bytes)
  const after = recordsOf(await exportFigFile(graph))
  for (const id of CONTENT) expect(after.get(id)?.name).toBe(before.get(id)?.name)
  expect(slotAssignments(after)).toContain('14:38:14:0=14:42')
})
