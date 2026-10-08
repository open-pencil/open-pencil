import { expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'
import { emptyBehaviour, readBehaviour } from '@open-pencil/scene-graph'

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
    exportSettings: [{ format: 'PNG', suffix: '', constraint: { type: 'SCALE', value: 2 } }]
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
