import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import {
  parseFigFile,
  populateFigPage,
  populateAllFigPages
} from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'
import { hasReaderSession } from '#core/kiwi/fig/session/recovery'

async function fixture(missingInternalDefault = false) {
  await initCodec()
  const graph = new SceneGraph()
  graph.createNode('TEXT', graph.getPages()[0].id, { text: 'First' })
  graph.createNode('TEXT', graph.addPage('Second').id, { text: 'Second' })
  const internal = graph.addPage('Internal resources')
  graph.updateNode(internal.id, { internalOnly: true })
  graph.createNode('RECTANGLE', internal.id, { name: 'Retained internal content', width: 37 })
  if (missingInternalDefault) {
    graph.createNode('COMPONENT', internal.id, {
      name: 'Invalid internal component',
      componentPropertyDefinitions: [
        {
          id: '10:1',
          name: 'Choice',
          type: 'INSTANCE_SWAP',
          defaultValue: '999:999'
        }
      ]
    })
  }
  const bytes = await exportFigFile(graph)
  return bytes.slice().buffer as ArrayBuffer
}

for (const populate of ['all', 'first-page', 'none'] as const) {
  test(`main-thread reader retains a live session for ${populate}`, async () => {
    const manifests: string[][] = []
    const graph = await parseFigFile(await fixture(), {
      populate,
      onPages: (pages) => manifests.push(pages.map((page) => page.name))
    })
    const pages = graph.getPages()
    expect(pages).toHaveLength(2)
    expect(graph.getPages(true)).toHaveLength(3)
    expect(
      graph.getPages(true).find((page) => page.name === 'Internal resources')?.internalOnly
    ).toBe(true)
    expect(manifests).toHaveLength(1)
    expect(manifests[0]).toContain('Second')
    expect(hasReaderSession(graph)).toBe(true)
    expect(graph.figSchemaDeflated).not.toBeNull()
    expect(graph.getChildren(pages[0].id)).toHaveLength(populate === 'none' ? 0 : 1)
    expect(graph.getChildren(pages[1].id)).toHaveLength(populate === 'all' ? 1 : 0)
    expect(populateAllFigPages(graph)).toBe(populate !== 'all')
    const first = graph.getChildren(pages[0].id)[0]
    graph.updateNode(first.id, { text: 'Edited' })
    expect(populateFigPage(graph, pages[0].id)).toBe(false)
    expect(graph.getNode(first.id)).toBe(first)
    expect(first.text).toBe('Edited')
    expect(populateAllFigPages(graph)).toBe(false)
    expect(graph.getChildren(pages[1].id)[0].text).toBe('Second')
    expect(populateFigPage(graph, 'missing')).toBe(false)
    releaseFigPopulationWorker(graph)
    expect(hasReaderSession(graph)).toBe(false)
  })
}

test('edited export loads missing pages on an isolated graph', async () => {
  const graph = await parseFigFile(await fixture(), { populate: 'first-page' })
  const pages = graph.getPages()
  const first = graph.getChildren(pages[0].id)[0]
  graph.updateNode(first.id, { text: 'Edited' })
  const before = structuredClone([...graph.nodes])
  const bytes = await exportFigFile(graph)
  expect([...graph.nodes]).toEqual(before)
  expect(graph.getChildren(pages[1].id)).toHaveLength(0)
  const reopened = await parseFigFile(bytes.slice().buffer as ArrayBuffer)
  const reopenedPages = reopened.getPages()
  expect(reopened.getChildren(reopenedPages[0].id)[0].text).toBe('Edited')
  expect(reopened.getChildren(reopenedPages[1].id)[0].text).toBe('Second')
  const internal = reopened.getPages(true).find((page) => page.internalOnly)
  if (!internal) throw new Error('Missing internal page')
  expect(populateFigPage(reopened, internal.id)).toBe(true)
  expect(reopened.getChildren(internal.id).map((node) => [node.name, node.width])).toEqual([
    ['Retained internal content', 37]
  ])
  expect(populateFigPage(graph, pages[1].id)).toBe(true)
  releaseFigPopulationWorker(graph)
  releaseFigPopulationWorker(reopened)
})

// Figma keeps property defaults that name a deleted component; so does an edited export.
test('export tolerates a deleted internal default without changing the live graph', async () => {
  const graph = await parseFigFile(await fixture(true), { populate: 'first-page' })
  const page = graph.getPages()[0]
  graph.updateNode(page.id, { name: 'Edited' })
  const before = structuredClone([...graph.nodes])
  const bytes = await exportFigFile(graph)
  expect(bytes.byteLength).toBeGreaterThan(0)
  expect([...graph.nodes]).toEqual(before)
  releaseFigPopulationWorker(graph)
})

test('page population is a no-op for non-FIG documents', () => {
  const graph = new SceneGraph()
  expect(populateFigPage(graph, graph.getPages()[0].id)).toBe(false)
  expect(populateAllFigPages(graph)).toBe(false)
})

test('main-thread parse honors pre-aborted requests', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(parseFigFile(await fixture(), { signal: controller.signal })).rejects.toThrow()
})
