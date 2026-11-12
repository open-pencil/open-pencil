import { expect, test } from 'bun:test'

import { isFigPagePending } from '@open-pencil/core/io/formats/fig'
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
