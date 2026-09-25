import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile, parseFigFile, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

test('new pages in reader-backed graphs are live and never queried from the archive', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id)
  const graph = await parseFigFile((await exportFigFile(source)).slice().buffer as ArrayBuffer, {
    populate: 'none'
  })
  const page = graph.addPage('New page')
  expect(populateFigPage(graph, page.id)).toBe(false)
  const editor = createEditor({ graph })
  await expect(editor.switchPage(page.id)).resolves.toBeUndefined()
  expect(editor.state.currentPageId).toBe(page.id)
})
