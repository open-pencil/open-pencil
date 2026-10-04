import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

import { parseFigFileViaWorker } from '#core/io/formats/fig/read'
import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'

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
