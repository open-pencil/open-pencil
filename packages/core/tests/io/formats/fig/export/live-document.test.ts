import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'
import { emptyBehaviour, readBehaviour, SceneGraph } from '@open-pencil/scene-graph'

import { settleFontDigestMap } from '#core/kiwi/fig/node-change/font/digests'
import { fontManager } from '#core/text/fonts'

// A save reads the document after its last wait, so the font digests it waits for must cover
// a font an edit brought in while they loaded.
test('font digests cover a font added while they load', async () => {
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/Inter-Regular.ttf'),
    'bundled Inter font'
  )
  fontManager.markLoaded('Inter', 'Regular', inter)
  fontManager.markLoaded('Inter', 'Bold', inter)
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  graph.createNode('TEXT', pageId, { text: 'Body', fontFamily: 'Inter', fontWeight: 400 })

  const settling = settleFontDigestMap(graph)
  graph.createNode('TEXT', pageId, { text: 'Heading', fontFamily: 'Inter', fontWeight: 700 })

  expect([...(await settling).keys()].toSorted()).toEqual(['Inter|Bold', 'Inter|Regular'])
})

// With nothing left to read from an archive, a save writes from the document itself, so
// nothing it writes onto a record may reach the layers it was written from.
test('saving a document leaves every layer as it was', async () => {
  await initCodec()
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const set = editor.graph.createNode('COMPONENT_SET', pageId, {
    name: 'Toggle',
    componentPropertyDefinitions: [
      { id: 'on', name: 'On', type: 'VARIANT', defaultValue: 'No', variantOptions: ['No', 'Yes'] }
    ]
  })
  for (const on of ['No', 'Yes'])
    editor.graph.createNode('COMPONENT', set.id, {
      name: `On=${on}`,
      componentPropertyValues: { On: on }
    })
  editor.setBehaviour(set.id, {
    ...emptyBehaviour('switch'),
    booleans: { checked: { propertyId: 'on', on: 'Yes', off: 'No' } }
  })
  editor.graph.createNode('RECTANGLE', pageId, {
    name: 'Exported',
    exportSettings: [{ format: 'png', scale: 2 }]
  })
  editor.graph.createNode('TEXT', pageId, {
    name: 'On a path',
    text: 'Curved',
    textPathBox: { x: 0, y: 0, width: 40, height: 20 }
  })
  const before = structuredClone([...editor.graph.nodes])

  const bytes = await exportFigFile(editor.graph)

  expect([...editor.graph.nodes]).toEqual(before)
  // The record still carries what the export added: the behaviour follows its property's GUID.
  const reopened = await parseFigFile(bytes.slice().buffer)
  const owner = [...reopened.nodes.values()].find((node) => node.name === 'Toggle')
  const property = owner?.componentPropertyDefinitions[0]?.id
  expect(property).not.toBe('on')
  expect(owner && readBehaviour(owner)?.booleans.checked?.propertyId).toBe(property)
})
