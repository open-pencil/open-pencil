import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { createFigDocumentSession } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

/**
 * Syncing visits every instance of a component, so doing it per placed instance costs a
 * pass over the whole graph for each one. A page placing many instances of one component
 * must still sync it once.
 */
test('a resumed page load syncs each component once, not once per instance it places', async () => {
  await initCodec()
  const source = new SceneGraph()
  const library = source.getPages()[0]
  const component = source.createNode('COMPONENT', library.id, { name: 'Badge' })
  source.createNode('TEXT', component.id, { name: 'Label', text: 'Badge' })
  const page = source.addPage('Placed')
  for (let index = 0; index < 8; index++) source.createInstance(component.id, page.id)
  const bytes = await exportFigFile(source)

  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  const synced: string[] = []
  const syncInstances = session.graph.syncInstances.bind(session.graph)
  session.graph.syncInstances = (componentId: string) => {
    synced.push(componentId)
    return syncInstances(componentId)
  }
  const placed = session.pages.find((candidate) => candidate.name === 'Placed')
  if (!placed) throw new Error('Missing placed page')
  session.loadPage(placed.id)

  // One component placed eight times is one sync, not eight.
  expect(synced.length).toBe(1)
  const pageId = session.graphPageId(placed.id)
  if (!pageId) throw new Error('Missing materialized page')
  const instances = session.graph.getChildren(pageId)
  expect(instances).toHaveLength(8)
  for (const instance of instances)
    expect(session.graph.getChildren(instance.id)[0].text).toBe('Badge')
})
