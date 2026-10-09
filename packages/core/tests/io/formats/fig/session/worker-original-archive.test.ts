import { expect, test } from 'bun:test'

import { isEqual } from 'es-toolkit/predicate'

import { exportFigFile } from '@open-pencil/core/io'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

import { parseFigFileViaWorker } from '#core/io/formats/fig/read'
import {
  createFigPopulationWorker,
  releaseFigPopulationWorker
} from '#core/kiwi/fig/population/client'

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
    const controller = new AbortController()
    const loading = createFigPopulationWorker(opened)?.populate(
      opened.getPages()[2].id,
      controller.signal
    )
    controller.abort()
    await expect(loading).rejects.toThrow('Aborted')
    edit(opened)
    expect(names(await exportFigFile(opened))).toContain('Edited again')
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)
