import { expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { createLibraryRevision, discoverPublishableLibraryChanges } from '@open-pencil/core/library'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'

// With a font at hand, saving shapes text and reading it back gives the text the height its
// lines reach, which the graph it came from never measured. That cache is no change to publish.
test('a FIG round trip with fonts loaded changes no library asset', async () => {
  await initCodec()
  await registerTestFont()
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button',
    width: 80,
    height: 32
  })
  graph.createNode('TEXT', component.id, { name: 'Label', text: 'Button', width: 60, height: 20 })
  const previous = await createLibraryRevision({ libraryId: 'library', name: 'Library', graph })

  const restored = await parseFigFile((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  const label = [...restored.getAllNodes()].find((node) => node.name === 'Label')
  expect(label?.derivedTextHeight).not.toBeNull()
  expect((await discoverPublishableLibraryChanges(previous, restored)).changes).toEqual([])
})

test('nested instances swapped to the same component keep identities of their own', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const star = graph.createNode('COMPONENT', page, { name: 'Star', componentKey: 'star' })
  const heart = graph.createNode('COMPONENT', page, { name: 'Heart', componentKey: 'heart' })
  const card = graph.createNode('COMPONENT', page, { name: 'Card', componentKey: 'card' })
  graph.createInstance(star.id, card.id)
  graph.createInstance(star.id, card.id)
  const toolbar = graph.createNode('COMPONENT', page, { name: 'Toolbar', componentKey: 'toolbar' })
  const placed = graph.createInstance(card.id, toolbar.id)
  if (!placed) throw new Error('Expected the card instance')
  for (const icon of graph.getChildren(placed.id)) graph.swapInstanceComponent(icon.id, heart.id)

  const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })

  const definition = [...revision.graph.getAllNodes()].find((node) => node.name === 'Toolbar')
  const [copy] = definition ? revision.graph.getChildren(definition.id) : []
  const icons = copy ? revision.graph.getChildren(copy.id) : []
  expect(icons).toHaveLength(2)
  expect(new Set(icons.map((icon) => icon.libraryLayerId)).size).toBe(2)
})

test('instances an instance holds in its slot keep identities of their own', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const star = graph.createNode('COMPONENT', page, { name: 'Star', componentKey: 'star' })
  const panel = graph.createNode('COMPONENT', page, {
    name: 'Panel',
    componentKey: 'panel',
    componentPropertyDefinitions: [
      { id: 'panel:content', name: 'Content', type: 'SLOT', defaultValue: '' }
    ]
  })
  graph.createNode('FRAME', panel.id, {
    name: 'Content',
    componentPropertyReferences: [{ propertyId: 'panel:content', field: 'SLOT_CONTENT' }]
  })
  const toolbar = graph.createNode('COMPONENT', page, { name: 'Toolbar', componentKey: 'toolbar' })
  const placed = graph.createInstance(panel.id, toolbar.id)
  if (!placed) throw new Error('Expected the panel instance')
  const [slot] = graph.getChildren(placed.id)
  graph.createInstance(star.id, slot.id)
  graph.createInstance(star.id, slot.id)
  graph.updateNode(placed.id, { componentPropertyAssignments: { 'panel:content': '' } })

  const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })

  const definition = [...revision.graph.getAllNodes()].find((node) => node.name === 'Toolbar')
  const [copy] = definition ? revision.graph.getChildren(definition.id) : []
  const [frame] = copy ? revision.graph.getChildren(copy.id) : []
  const stars = frame ? revision.graph.getChildren(frame.id) : []
  expect(stars).toHaveLength(2)
  expect(new Set(stars.map((node) => node.libraryLayerId)).size).toBe(2)
})
