import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { exportFigFile, isFigPagePending } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { repoPath } from '@open-pencil/test-support/paths'

import { readFigDocument } from '@/app/document/io/fig'

test('reads a .fig with every page left to load as it is shown', async () => {
  const bytes = await Bun.file(repoPath('tests/fixtures/slots.fig')).arrayBuffer()

  const graph = await readFigDocument(new File([bytes], 'slots.fig'))

  const pages = graph.getPages()
  expect(pages.length).toBeGreaterThan(0)
  expect(
    pages.filter((page) => !isFigPagePending(graph, page.id)).map((page) => page.name)
  ).toEqual([])
})

test('leaves a Cover page unread until it is shown, then shows its layers', async () => {
  await initCodec()
  const source = new SceneGraph()
  const cover = source.addPage('Cover')
  source.createNode('FRAME', cover.id, { name: 'Cover art', width: 1920, height: 960 })
  const bytes = await exportFigFile(source)

  const graph = await readFigDocument(new File([bytes.slice()], 'cover.fig'))
  const opened = graph.getPages().find((page) => page.name === 'Cover')
  if (!opened) throw new Error('Expected the Cover page')
  expect(isFigPagePending(graph, opened.id)).toBe(true)
  expect(graph.getChildren(opened.id)).toEqual([])

  const editor = createEditor({ graph })
  await editor.switchPage(opened.id)

  expect(isFigPagePending(graph, opened.id)).toBe(false)
  expect(graph.getChildren(opened.id).map((node) => node.name)).toEqual(['Cover art'])
  editor.dispose()
})
