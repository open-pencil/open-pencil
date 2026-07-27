import { describe, expect, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

import { loadDocument, prepareDocumentForRpc } from '#cli/headless'

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function createLazyFixture() {
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
  graph.createNode('INSTANCE', page2.id, {
    name: 'Button instance 2',
    componentId: component.id,
    width: 100,
    height: 40
  })

  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-headless-lazy-'))
  const path = join(dir, 'lazy.fig')
  const result = await io.writeDocument('fig', graph)
  await Bun.write(path, result.data as Uint8Array)
  return loadDocument(path)
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
    const page2Instance = pageInstance(graph, 'Page 2')

    expect(page1Instance ? graph.getChildren(page1Instance.id) : []).toHaveLength(1)
    expect(page2Instance ? graph.getChildren(page2Instance.id) : []).toHaveLength(0)

    prepareDocumentForRpc(graph, 'tree', { page: 'Page 2' })

    expect(page2Instance ? graph.getChildren(page2Instance.id) : []).toHaveLength(1)
  })

  test('populates all pages for document-wide searches', async () => {
    const graph = await createLazyFixture()
    const page2Instance = pageInstance(graph, 'Page 2')

    prepareDocumentForRpc(graph, 'find', {})

    expect(page2Instance ? graph.getChildren(page2Instance.id) : []).toHaveLength(1)
  })

  test('keeps page listings lazy', async () => {
    const graph = await createLazyFixture()
    const page2Instance = pageInstance(graph, 'Page 2')

    prepareDocumentForRpc(graph, 'pages')

    expect(page2Instance ? graph.getChildren(page2Instance.id) : []).toHaveLength(0)
  })
})
