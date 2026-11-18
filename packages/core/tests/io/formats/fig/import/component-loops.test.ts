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

const savedIds = async (graph: Awaited<ReturnType<typeof parseFigFile>>) =>
  parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer).nodeChanges.flatMap(
    (change) => (change.guid ? [`${change.guid.sessionID}:${change.guid.localID}`] : [])
  )

test('a save drops the instance a component loop repair left out', async () => {
  const graph = await parseFigFile(await loopedFile(), { populate: 'all' })
  expect(
    readerDiagnostics(graph).flatMap((entry) => (entry.kind === 'cycle' ? [entry.diagnostic] : []))
  ).toEqual([{ instanceId: '1:21' }])

  // Unedited, the document still differs from its archive by the repair.
  const unedited = await savedIds(graph)
  expect(unedited).toContain('1:11')
  expect(unedited).not.toContain('1:21')

  graph.updateNode(graph.getPages()[0].id, { name: 'Edited page' })
  const edited = await savedIds(graph)
  expect(edited).toContain('1:11')
  expect(edited).not.toContain('1:21')
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
    const saved = await savedIds(graph)
    expect(saved).toContain('1:10')
    expect(saved).not.toContain('1:11')
  }
)
