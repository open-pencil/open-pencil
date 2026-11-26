import { expect, test } from 'bun:test'

import { deflateSync } from 'fflate'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer, writeFigArchive } from '@open-pencil/fig'
import type { GUID } from '@open-pencil/kiwi/fig'
import {
  getCompiledSchema,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { readerDiagnostics } from '#core/kiwi/fig/session/document-state'

const guid = (localID: number): GUID => ({ sessionID: 1, localID })

function record(localID: number, type: string, parent: number | undefined, fields = {}) {
  return {
    guid: guid(localID),
    type,
    phase: 'CREATED',
    name: `${type} ${localID}`,
    ...(parent === undefined
      ? {}
      : { parentIndex: { guid: guid(parent), position: `${localID}` } }),
    ...fields
  } as NodeChange
}

const instanceOf = (localID: number, parent: number, component: number) =>
  record(localID, 'INSTANCE', parent, { symbolData: { symbolID: guid(component) } })

async function archiveOf(nodeChanges: NodeChange[]): Promise<ArrayBuffer> {
  await initCodec()
  const kiwi = getCompiledSchema().encodeMessage({
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges
  })
  const archive = writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: kiwi,
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{}'
  })
  return new Uint8Array(archive).buffer
}

// Inner holds Outer and Outer holds Inner. Inner comes first, so Outer loses its instance of
// Inner, as Figma's repair deletes it.
const loopedFile = () =>
  archiveOf([
    record(0, 'DOCUMENT', undefined),
    record(1, 'CANVAS', 0),
    record(10, 'SYMBOL', 1),
    instanceOf(11, 10, 20),
    record(20, 'SYMBOL', 1),
    instanceOf(21, 20, 10)
  ])

const idOf = (change: NodeChange) => (change.guid ? guidToString(change.guid) : '')

/** The saved records, by id. */
const saved = async (graph: Awaited<ReturnType<typeof parseFigFile>>) =>
  new Map(
    parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer).nodeChanges.map(
      (change) => [idOf(change), change]
    )
  )

test('a save drops the instance a component loop repair left out', async () => {
  const graph = await parseFigFile(await loopedFile(), { populate: 'all' })
  expect(
    readerDiagnostics(graph).flatMap((entry) => (entry.kind === 'cycle' ? [entry.diagnostic] : []))
  ).toEqual([{ instanceId: '1:21' }])

  // Unedited, the document still differs from its archive by the repair.
  const unedited = await saved(graph)
  expect(unedited.has('1:11')).toBe(true)
  expect(unedited.has('1:21')).toBe(false)

  graph.updateNode(graph.getPages()[0].id, { name: 'Edited page' })
  const edited = await saved(graph)
  expect(edited.get('1:1')?.name).toBe('Edited page')
  expect(edited.has('1:11')).toBe(true)
  expect(edited.has('1:21')).toBe(false)
})

test.each([false, true])(
  'a save drops an instance of its own component, used as a base elsewhere: %p',
  async (usedAsBase) => {
    const graph = await parseFigFile(
      await archiveOf([
        record(0, 'DOCUMENT', undefined),
        record(1, 'CANVAS', 0),
        record(10, 'SYMBOL', 1),
        instanceOf(11, 10, 10),
        ...(usedAsBase ? [instanceOf(12, 1, 11)] : [])
      ]),
      { populate: 'all' }
    )
    const records = await saved(graph)
    expect(records.has('1:10')).toBe(true)
    expect(records.has('1:11')).toBe(false)
    // The placement keeps its record as written; its base is gone, as the first read showed it.
    if (usedAsBase) expect(records.get('1:12')?.symbolData?.symbolID).toEqual(guid(11))
  }
)

test('a save drops the instance a component defined inside its own component holds', async () => {
  const graph = await parseFigFile(
    await archiveOf([
      record(0, 'DOCUMENT', undefined),
      record(1, 'CANVAS', 0),
      record(10, 'SYMBOL', 1),
      record(20, 'SYMBOL', 10),
      instanceOf(21, 20, 10),
      instanceOf(30, 1, 20)
    ]),
    { populate: 'all' }
  )
  const records = await saved(graph)
  expect(records.has('1:20')).toBe(true)
  expect(records.has('1:21')).toBe(false)
})

test('a save drops the instance whose slot content leads back into its component', async () => {
  const slotValue = (target: GUID) => ({
    value: { slotContentIdValue: { guid: target } },
    dataType: 'SLOT_CONTENT_ID',
    resolvedDataType: 'SLOT_CONTENT_ID'
  })
  const graph = await parseFigFile(
    await archiveOf([
      record(0, 'DOCUMENT', undefined),
      record(1, 'CANVAS', 0),
      record(2, 'CANVAS', 0, { internalOnly: true }),
      record(3, 'SYMBOL', 1, {
        componentPropDefs: [{ id: guid(5), name: 'Content', type: 'SLOT' }]
      }),
      record(4, 'FRAME', 3, {
        parameterConsumptionMap: {
          entries: [
            {
              variableField: 'SLOT_CONTENT_ID',
              variableData: {
                value: { propRefValue: { defId: guid(5) } },
                dataType: 'PROP_REF',
                resolvedDataType: 'SLOT_CONTENT_ID'
              }
            }
          ]
        }
      }),
      record(10, 'SYMBOL', 1),
      record(11, 'INSTANCE', 10, {
        symbolData: { symbolID: guid(3) },
        componentPropAssignments: [{ defID: guid(5), varValue: slotValue(guid(20)) }]
      }),
      record(20, 'FRAME', 2),
      instanceOf(21, 20, 10)
    ]),
    { populate: 'all' }
  )
  const records = await saved(graph)
  expect(records.has('1:10')).toBe(true)
  expect(records.has('1:11')).toBe(false)
  expect(records.has('1:21')).toBe(true)
})
