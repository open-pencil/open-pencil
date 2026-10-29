import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { exportFigFile, parseFigFile } from '#core/io/formats/fig'
import { planPDFPages } from '#core/io/formats/pdf/plan'
import { readPDFPages } from '#core/io/formats/pdf/prepare'
import { initCodec } from '@open-pencil/kiwi/fig/codec'

/** A `.fig` opened as the editor opens one: only its first page read. */
async function openedFig() {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'First', width: 10, height: 10 })
  for (const name of ['Second', 'Third']) {
    source.createNode('RECTANGLE', source.addPage(name).id, { name, width: 10, height: 10 })
  }
  const bytes = await exportFigFile(source)
  return parseFigFile(bytes.buffer as ArrayBuffer, { populate: 'first-page' })
}

test('pages not read yet are read before a pages export is planned', async () => {
  const graph = await openedFig()
  const [first, second, third] = graph.getPages()
  const plan = () => planPDFPages(graph, { mode: 'pages', currentPageId: first.id })

  expect(plan().map((spec) => spec.pageId)).toEqual([first.id])
  readPDFPages(graph)
  expect(plan().map((spec) => spec.pageId)).toEqual([first.id, second.id, third.id])
})

test('an empty page list reads every page, as it exports every page', async () => {
  const graph = await openedFig()
  const [first, second, third] = graph.getPages()

  readPDFPages(graph, [])

  const planned = planPDFPages(graph, { mode: 'pages', pageIds: [], currentPageId: first.id })
  expect(planned.map((spec) => spec.pageId)).toEqual([first.id, second.id, third.id])
})

test('only the pages a pages export asks for are read', async () => {
  const graph = await openedFig()
  const [, second, third] = graph.getPages()

  readPDFPages(graph, [second.id])

  expect(graph.getChildren(second.id)).toHaveLength(1)
  expect(graph.getChildren(third.id)).toHaveLength(0)
})
