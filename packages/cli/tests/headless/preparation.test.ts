import { describe, expect, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

import {
  loadDocument,
  populateNodePage,
  populateWholeDocument,
  prepareDocumentForRPC
} from '#cli/headless'

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function writeLazyFixture() {
  const graph = new SceneGraph()
  const [page1] = graph.getPages()
  page1.name = 'Page 1'
  const page2 = graph.addPage('Page 2')
  const component = graph.createNode('COMPONENT', page1.id, {
    name: 'Button',
    width: 100,
    height: 40
  })
  graph.createNode('RECTANGLE', component.id, {
    name: 'Background',
    width: 100,
    height: 40
  })
  graph.createNode('INSTANCE', page1.id, {
    name: 'Button instance 1',
    componentId: component.id,
    width: 100,
    height: 40
  })
  for (const [index, page] of [page2, graph.addPage('Page 3')].entries())
    graph.createNode('INSTANCE', page.id, {
      name: `Button instance ${index + 2}`,
      componentId: component.id,
      width: 100,
      height: 40
    })

  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-headless-lazy-'))
  const path = join(dir, 'lazy.fig')
  const result = await io.writeDocument('fig', graph)
  await Bun.write(path, result.data as Uint8Array)
  return path
}

async function createLazyFixture() {
  return loadDocument(await writeLazyFixture())
}

/** The IDs of Page 3's instance and the layer inside it, as a load of every page names them. */
async function page3LayerIds(path: string) {
  const graph = await loadDocument(path)
  populateWholeDocument(graph)
  const instance = pageInstance(graph, 'Page 3')
  if (!instance) throw new Error('The fixture has no instance on Page 3')
  return { instance: instance.id, insideInstance: graph.getChildren(instance.id)[0].id }
}

function pageInstance(graph: SceneGraph, pageName: string) {
  const page = graph.getPages().find((candidate) => candidate.name === pageName)
  return page
    ? graph.getChildren(page.id).find((candidate) => candidate.type === 'INSTANCE')
    : undefined
}

describe('headless CLI lazy .fig preparation', () => {
  test('populates only the requested tree page', async () => {
    const graph = await createLazyFixture()
    const page1Instance = pageInstance(graph, 'Page 1')

    expect(page1Instance ? graph.getChildren(page1Instance.id) : []).toHaveLength(1)
    expect(pageInstance(graph, 'Page 2')).toBeUndefined()

    prepareDocumentForRPC(graph, 'tree', { page: 'Page 2' })

    const page2Instance = pageInstance(graph, 'Page 2')
    expect(page2Instance ? graph.getChildren(page2Instance.id) : []).toHaveLength(1)
  })

  test('populates all pages for document-wide searches', async () => {
    const graph = await createLazyFixture()
    expect(pageInstance(graph, 'Page 2')).toBeUndefined()
    prepareDocumentForRPC(graph, 'find', {})
    const page2Instance = pageInstance(graph, 'Page 2')
    expect(page2Instance ? graph.getChildren(page2Instance.id) : []).toHaveLength(1)
  })

  test('keeps page listings lazy', async () => {
    const graph = await createLazyFixture()
    prepareDocumentForRPC(graph, 'pages')
    expect(pageInstance(graph, 'Page 2')).toBeUndefined()
  })

  test('loads only the page holding an exported node', async () => {
    const path = await writeLazyFixture()
    const { instance } = await page3LayerIds(path)
    const graph = await loadDocument(path)

    await populateNodePage(graph, instance)

    expect(graph.getChildren(instance)).toHaveLength(1)
    expect(pageInstance(graph, 'Page 2')).toBeUndefined()
  })

  test('loads every page for a layer inside an instance, which has no record of its own', async () => {
    const path = await writeLazyFixture()
    const { insideInstance } = await page3LayerIds(path)
    const graph = await loadDocument(path)

    await populateNodePage(graph, insideInstance)

    expect(graph.getNode(insideInstance)?.name).toBe('Background')
  })
})
