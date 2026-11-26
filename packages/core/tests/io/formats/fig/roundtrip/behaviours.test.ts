import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import {
  emptyBehaviour,
  guessInteractionStates,
  missingBindings,
  readBehaviour
} from '@open-pencil/scene-graph/behaviours'

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
      states: guessInteractionStates('textField', 'interaction', ['Default', 'Focus'])
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

test('a transition follows its variables to the GUIDs the save gives them', async () => {
  await initCodec()
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const motion = editor.graph.createCollection('Motion')
  // The variables dialog names a new variable `var:…`, which no file can keep as its GUID.
  editor.graph.addVariable({
    id: 'var:fast',
    name: 'Duration/Fast',
    type: 'TIMING',
    collectionId: motion.id,
    valuesByMode: { [motion.defaultModeId]: 0.15 },
    description: '',
    hiddenFromPublishing: false
  })
  const set = editor.graph.createNode('COMPONENT_SET', pageId, { name: 'Button' })
  editor.graph.createNode('COMPONENT', set.id, { name: 'State=Default' })
  editor.setBehaviour(set.id, {
    ...emptyBehaviour('button'),
    transition: {
      duration: 0.15,
      easing: { easing: 'OUT_CUBIC' },
      durationVariableId: 'var:fast'
    }
  })

  const reopened = await parseFigFile((await exportFigFile(editor.graph)).slice().buffer)
  const owner = [...reopened.nodes.values()].find((node) => node.name === 'Button')
  const transition = owner && readBehaviour(owner)?.transition
  const fast = [...reopened.variables.values()].find((item) => item.name === 'Duration/Fast')
  expect(fast?.id).not.toBe('var:fast')
  expect(transition).toEqual({
    duration: 0.15,
    easing: { easing: 'OUT_CUBIC' },
    durationVariableId: fast?.id
  })
})
