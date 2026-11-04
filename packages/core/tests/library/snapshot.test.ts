import { expect, test } from 'bun:test'

import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { createLibraryRevision, discoverPublishableLibraryChanges } from '@open-pencil/core/library'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

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
