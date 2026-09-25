import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { createFigDocumentSession } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

test('outer component edits win over inner defaults for later-loaded nested instance roots', async () => {
  await initCodec()
  const source = new SceneGraph()
  const first = source.getPages()[0]
  const second = source.addPage('Second')
  const inner = source.createNode('COMPONENT', first.id, { name: 'Inner', opacity: 1 })
  const outer = source.createNode('COMPONENT', first.id, { name: 'Outer' })
  source.createInstance(inner.id, outer.id)
  source.createInstance(outer.id, second.id)
  const bytes = await exportFigFile(source)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  session.loadPage(session.pages[0].id)
  const graph = session.graph
  const liveInner = [...graph.getAllNodes()].find(
    (node) => node.type === 'COMPONENT' && node.name === 'Inner'
  )
  const liveOuter = [...graph.getAllNodes()].find(
    (node) => node.type === 'COMPONENT' && node.name === 'Outer'
  )
  if (!liveInner || !liveOuter) throw new Error('Missing components')
  graph.updateNode(liveInner.id, { opacity: 0.3 })
  graph.updateNode(graph.getChildren(liveOuter.id)[0].id, { opacity: 0.6 })
  session.loadPage(session.pages[1].id)
  const pageId = session.graphPageId(session.pages[1].id)
  if (!pageId) throw new Error('Missing second page')
  const instance = graph.getChildren(pageId)[0]
  expect(graph.getChildren(instance.id)[0].opacity).toBe(0.6)
})
