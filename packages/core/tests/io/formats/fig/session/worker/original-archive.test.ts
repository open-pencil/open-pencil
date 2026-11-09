import { expect, test } from 'bun:test'

import { isEqual } from 'es-toolkit/predicate'

import {
  exportFigFile,
  exportFigFileStream,
  populateFigPage,
  stopFigReaderWorker
} from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer, readStreamBytes } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { parseFigFileViaWorker } from '#core/io/formats/fig/read'
import {
  createFigPopulationWorker,
  releaseFigPopulationWorker
} from '#core/kiwi/fig/population/client'
import { figArchive } from '#core/kiwi/fig/session/archive/access'
import { pendingReaderPageOfNode } from '#core/kiwi/fig/session/document-state'

test('saving an unedited worker-opened .fig returns its original bytes', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { text: 'First' })
  source.createNode('TEXT', source.addPage('Second').id, { text: 'Second' })
  const bytes = await exportFigFile(source)

  const opened = await parseFigFileViaWorker(bytes.slice().buffer, { populate: 'first-page' })
  try {
    expect(await exportFigFile(opened)).toEqual(bytes)
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('loading a page through the worker keeps saving the original bytes', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { text: 'First' })
  source.createNode('TEXT', source.addPage('Second').id, { text: 'Second' })
  const bytes = await exportFigFile(source)

  const opened = await parseFigFileViaWorker(bytes.slice().buffer, { populate: 'first-page' })
  try {
    const second = opened.getPages()[1]
    expect(await createFigPopulationWorker(opened)?.populate(second.id)).toBe(true)
    expect(opened.getChildren(second.id)).toHaveLength(1)
    expect(await exportFigFile(opened)).toEqual(bytes)
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('an edited worker-opened .fig is written by the worker with only its edit re-encoded', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'Kept' })
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'Renamed' })
  source.createNode('TEXT', source.addPage('Second').id, { text: 'Second' })
  const bytes = await exportFigFile(source)

  const opened = await parseFigFileViaWorker(bytes.slice().buffer, { populate: 'first-page' })
  try {
    const renamed = opened.getChildren(opened.getPages()[0].id)[1]
    opened.updateNode(renamed.id, { name: 'Renamed again' })
    const written = parseFigBuffer((await exportFigFile(opened)).slice().buffer).nodeChanges
    const original = parseFigBuffer(bytes.slice().buffer).nodeChanges
    expect(written.map((record) => record.name)).toEqual(
      original.map((record) => (record.name === 'Renamed' ? 'Renamed again' : record.name))
    )
    expect(written.filter((record, index) => !isEqual(record, original[index]))).toHaveLength(1)
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('an edited worker-opened .fig streams from the worker as it is read', async () => {
  const opened = await openViaWorker()
  edit(opened)
  try {
    expect(names(await readStreamBytes(await exportFigFileStream(opened)))).toContain('Edited again')
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('a save still streaming from the worker fails when the document closes', async () => {
  const opened = await openViaWorker()
  edit(opened)
  const reader = (await exportFigFileStream(opened)).getReader()
  expect((await reader.read()).done).toBe(false)
  releaseFigPopulationWorker(opened)
  await expect(reader.read()).rejects.toThrow('The document closed')
}, 20000)

test('a save streaming from the worker finishes when a page load is abandoned', async () => {
  const opened = await openViaWorker()
  edit(opened)
  try {
    const reader = (await exportFigFileStream(opened)).getReader()
    const chunks: Uint8Array<ArrayBuffer>[] = []
    const first = await reader.read()
    if (first.value) chunks.push(first.value.slice())
    // What an abandoned page load does to the archive the worker serves.
    const archive = figArchive(opened)
    if (!archive || !('dropWorker' in archive) || typeof archive.dropWorker !== 'function') {
      throw new Error('The archive is not served by the worker')
    }
    archive.dropWorker()
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      chunks.push(next.value.slice())
    }
    expect(names(new Uint8Array(await new Blob(chunks).arrayBuffer()))).toContain('Edited again')
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('a document whose reader worker stopped loads its pages and saves on this thread', async () => {
  const opened = await openViaWorker()
  try {
    stopFigReaderWorker(opened)
    expect(createFigPopulationWorker(opened)).toBeNull()
    const third = opened.getPages()[2]
    expect(populateFigPage(opened, third.id)).toBe(true)
    expect(opened.getChildren(third.id)).toHaveLength(1)
    edit(opened)
    expect(names(await exportFigFile(opened))).toContain('Edited again')
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

async function openViaWorker() {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'Edited' })
  source.createNode('TEXT', source.addPage('Second').id, { text: 'Second' })
  source.createNode('TEXT', source.addPage('Third').id, { text: 'Third' })
  const bytes = await exportFigFile(source)
  return parseFigFileViaWorker(bytes.slice().buffer, { populate: 'first-page' })
}

function edit(graph: SceneGraph) {
  const [edited] = graph.getChildren(graph.getPages()[0].id)
  graph.updateNode(edited.id, { name: 'Edited again' })
}

const names = (bytes: Uint8Array) =>
  parseFigBuffer(bytes.slice().buffer).nodeChanges.flatMap((record) => record.name ?? [])

test('a page load that finds the graph diverged leaves the worker writing the archive', async () => {
  const opened = await openViaWorker()
  edit(opened)
  try {
    const worker = createFigPopulationWorker(opened)
    expect(await worker?.populate(opened.getPages()[1].id)).toBeNull()
    worker?.terminate()
    expect(names(await exportFigFile(opened))).toContain('Edited again')
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('an abandoned page load stops the worker, and the archive is written without it', async () => {
  const opened = await openViaWorker()
  try {
    // What an abandoned page load does to the archive the worker serves.
    const archive = figArchive(opened)
    if (!archive || !('dropWorker' in archive) || typeof archive.dropWorker !== 'function') {
      throw new Error('The archive is not served by the worker')
    }
    archive.dropWorker()
    edit(opened)
    expect(names(await exportFigFile(opened))).toContain('Edited again')
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('a layer named by its ID on a page not loaded yet is found through the worker', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { text: 'First' })
  const later = source.createNode('TEXT', source.addPage('Second').id, { text: 'Second' })
  const bytes = await exportFigFile(source)

  const opened = await parseFigFileViaWorker(bytes.slice().buffer, { populate: 'first-page' })
  try {
    const second = opened.getPages()[1]
    const figma = new FigmaAPI(opened, {
      loadPage: async (id) => {
        await createFigPopulationWorker(opened)?.populate(id)
      },
      pageOfNode: (id) => pendingReaderPageOfNode(opened, id)
    })
    expect(opened.getNode(later.id)).toBeUndefined()
    expect(await pendingReaderPageOfNode(opened, later.id)).toBe(second.id)
    expect((await figma.getNodeByIdAsync(later.id))?.characters).toBe('Second')
    expect(opened.getChildren(second.id)).toHaveLength(1)
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)
