import { expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { populateAllFigPages, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

async function createLazyGraph() {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'First' })
  source.createNode('RECTANGLE', source.addPage('Page 2').id, { name: 'Second' })
  const bytes = await exportFigFile(source)
  return parseFigFile(bytes.slice().buffer as ArrayBuffer, { populate: 'none' })
}

test('replacement session populates an unvisited page exactly once', async () => {
  const graph = await createLazyGraph()
  const [first, second] = graph.getPages()
  expect(graph.getChildren(first.id)).toHaveLength(0)
  expect(populateFigPage(graph, second.id)).toBe(true)
  expect(graph.getChildren(first.id)).toHaveLength(0)
  expect(graph.getChildren(second.id).map((node) => node.name)).toEqual(['Second'])
  const count = graph.nodes.size
  expect(populateFigPage(graph, second.id)).toBe(false)
  expect(graph.nodes.size).toBe(count)
})

test('replacement session populates all remaining pages once', async () => {
  const graph = await createLazyGraph()
  expect(populateAllFigPages(graph)).toBe(true)
  expect(graph.getPages().map((page) => graph.getChildren(page.id).length)).toEqual([1, 1])
  expect(populateAllFigPages(graph)).toBe(false)
})
