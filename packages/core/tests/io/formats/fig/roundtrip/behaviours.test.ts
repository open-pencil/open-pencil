import { describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'
import {
  emptyBehaviour,
  guessInteractionStates,
  missingBindings,
  readBehaviour
} from '@open-pencil/scene-graph'

describe('.fig round trip of behaviours', () => {
  test('bindings follow the GUIDs their component properties get', async () => {
    await initCodec()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const set = editor.graph.createNode('COMPONENT_SET', pageId, {
      name: 'Field',
      componentPropertyDefinitions: [
        {
          id: 'filled',
          name: 'Filled',
          type: 'VARIANT',
          defaultValue: 'No',
          variantOptions: ['No', 'Yes']
        },
        {
          id: 'interaction',
          name: 'Interaction',
          type: 'VARIANT',
          defaultValue: 'Default',
          variantOptions: ['Default', 'Focus']
        },
        { id: 'value', name: 'Value', type: 'TEXT', defaultValue: 'Email' }
      ]
    })
    for (const filled of ['No', 'Yes'])
      for (const interaction of ['Default', 'Focus']) {
        const variant = editor.graph.createNode('COMPONENT', set.id, {
          name: `Filled=${filled}, Interaction=${interaction}`,
          componentPropertyValues: { Filled: filled, Interaction: interaction }
        })
        editor.graph.createNode('TEXT', variant.id, {
          text: 'Email',
          componentPropertyReferences: [{ propertyId: 'value', field: 'TEXT' }]
        })
      }
    editor.setBehaviour(set.id, {
      ...emptyBehaviour('textField'),
      texts: { value: { propertyId: 'value' } },
      booleans: { filled: { propertyId: 'filled', on: 'Yes', off: 'No' } },
      states: guessInteractionStates('interaction', ['Default', 'Focus'])
    })
    expect(
      missingBindings(editor.graph, set, readBehaviour(set) ?? emptyBehaviour('button'))
    ).toEqual([])

    const reopened = await parseFigFile((await exportFigFile(editor.graph)).slice().buffer)
    const owner = [...reopened.nodes.values()].find((node) => node.name === 'Field')
    const behaviour = owner && readBehaviour(owner)
    if (!owner || !behaviour) throw new Error('Behaviour lost')
    expect(missingBindings(reopened, owner, behaviour)).toEqual([])
    const ids = new Map(owner.componentPropertyDefinitions.map((item) => [item.name, item.id]))
    expect(behaviour.texts.value.propertyId).toBe(ids.get('Value') ?? '')
    expect(behaviour.booleans.filled.propertyId).toBe(ids.get('Filled') ?? '')
    expect(behaviour.states?.propertyId).toBe(ids.get('Interaction'))
    // The document keeps its own ids.
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)?.texts.value.propertyId).toBe('value')
  })
})
