import { describe, expect, test } from 'bun:test'

import {
  behaviourOwner,
  emptyBehaviour,
  missingBindings,
  readBehaviour,
  withBehaviour
} from '@open-pencil/core/behaviours'
import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

/** A Switch set with a State variant property and a Thumb slot. */
function switchSet() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Switch',
    componentPropertyDefinitions: [
      { id: 'state', name: 'State', type: 'VARIANT', defaultValue: 'Off', variantOptions: ['On', 'Off'] }
    ]
  })
  const on = graph.createNode('COMPONENT', set.id, {
    name: 'State=On',
    componentPropertyValues: { State: 'On' },
    componentPropertyDefinitions: [{ id: 'thumb', name: 'Thumb', type: 'SLOT', defaultValue: '' }]
  })
  return { graph, set, on }
}

describe('behaviour model', () => {
  test('a variant keeps its behaviour on its set', () => {
    const { graph, set, on } = switchSet()
    expect(behaviourOwner(graph, on)?.id).toBe(set.id)
    expect(behaviourOwner(graph, set)?.id).toBe(set.id)
  })

  test('round-trips through plugin data and reports what is still unbound', () => {
    const { graph, set } = switchSet()
    const behaviour = emptyBehaviour('switch')
    graph.updateNode(set.id, { pluginData: withBehaviour(set, behaviour) })
    expect(readBehaviour(set)).toEqual(behaviour)
    expect(missingBindings(graph, set, behaviour)).toEqual(['value'])

    const bound = { ...behaviour, booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } } }
    expect(missingBindings(graph, set, bound)).toEqual([])
    expect(missingBindings(graph, set, { ...bound, parts: { thumb: 'state' } })).toEqual([])

    graph.updateNode(set.id, { pluginData: withBehaviour(set, null) })
    expect(readBehaviour(set)).toBeNull()
  })

  test('a slider keeps its own number range and requires track and thumb slots', () => {
    const { graph, set } = switchSet()
    const slider = emptyBehaviour('slider')
    expect(slider.numbers.value).toEqual({ min: 0, max: 100, step: 1, default: 50 })
    expect(missingBindings(graph, set, slider)).toEqual(['track', 'thumb'])
    expect(missingBindings(graph, set, { ...slider, parts: { track: 'state', thumb: 'thumb' } })).toEqual([
      'track'
    ])
  })

  test('unreadable plugin data reads as no behaviour', () => {
    const { graph, set } = switchSet()
    graph.updateNode(set.id, {
      pluginData: [{ pluginId: 'open-pencil', key: 'behaviour', value: '{"kind":"dial"}' }]
    })
    expect(readBehaviour(set)).toBeNull()
  })
})

describe('setBehaviour', () => {
  test('adds, edits, and removes as single undo steps', () => {
    const editor = createEditor()
    const set = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, { name: 'Switch' })
    editor.setBehaviour(set.id, emptyBehaviour('switch'))
    expect(editor.undo.undoLabel).toBe('Add behaviour')
    editor.setBehaviour(set.id, { ...emptyBehaviour('switch'), parts: { thumb: 'x' } })
    expect(editor.undo.undoLabel).toBe('Edit behaviour')
    editor.setBehaviour(set.id, null)
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)).toBeNull()

    editor.undo.undo()
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)?.parts).toEqual({ thumb: 'x' })
    editor.undo.undo()
    editor.undo.undo()
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)).toBeNull()
  })
})
