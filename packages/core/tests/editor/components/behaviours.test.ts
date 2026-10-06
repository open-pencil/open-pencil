import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  emptyBehaviour,
  missingBindings,
  readBehaviour,
  type Behaviour
} from '@open-pencil/scene-graph'

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

describe('completing a behaviour', () => {
  /** A main component drawn as a plain rectangle, as a designer starts one. */
  function bareComponent(kind: Behaviour['kind']) {
    const editor = createEditor()
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Field',
      width: 220,
      height: 120
    })
    editor.graph.createNode('RECTANGLE', component.id, { name: 'Box', width: 220, height: 120 })
    editor.setBehaviour(component.id, emptyBehaviour(kind))
    const behaviour = () => readBehaviour(editor.graph.getNode(component.id) ?? component)
    return { editor, component, behaviour }
  }

  test('a textarea drawn as a rectangle gets a text layer and property in one step', () => {
    const { editor, component, behaviour } = bareComponent('textarea')
    const undoDepth = editor.undo.undoLabel
    const id = editor.addBehaviourText(component.id, 'value', 'Text')
    if (!id) throw new Error('No text property')

    const text = editor.graph.getChildren(component.id).find((child) => child.type === 'TEXT')
    expect(text?.componentPropertyReferences).toEqual([{ propertyId: id, field: 'TEXT' }])
    expect(editor.graph.getNode(component.id)?.componentPropertyDefinitions).toEqual([
      { id, name: 'Text', type: 'TEXT', defaultValue: 'Text' }
    ])
    const current = behaviour()
    expect(current && missingBindings(editor.graph, component, current)).toEqual([])

    editor.undo.undo()
    expect(editor.undo.undoLabel).toBe(undoDepth)
    expect(editor.graph.getChildren(component.id).map((child) => child.type)).toEqual([
      'RECTANGLE'
    ])
    expect(behaviour()?.texts).toEqual({})
    expect(editor.graph.getNode(component.id)?.componentPropertyDefinitions).toEqual([])
  })

  test('an existing text layer becomes the text instead of a new one', () => {
    const { editor, component } = bareComponent('textField')
    const label = editor.graph.createNode('TEXT', component.id, { name: 'Label', text: 'Email' })
    const id = editor.addBehaviourText(component.id, 'value', 'Text')
    expect(editor.graph.getChildren(component.id).filter((child) => child.type === 'TEXT')).toHaveLength(
      1
    )
    expect(editor.graph.getNode(label.id)?.componentPropertyReferences).toEqual([
      { propertyId: id, field: 'TEXT' }
    ])
    expect(
      editor.graph.getNode(component.id)?.componentPropertyDefinitions[0]?.defaultValue
    ).toBe('Email')
  })

  test('a switch set gets Off and On variants of each variant in one step', () => {
    const editor = createEditor()
    const set = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, {
      name: 'Switch'
    })
    editor.graph.createNode('COMPONENT', set.id, { name: 'Default', width: 40, height: 20 })
    editor.setBehaviour(set.id, emptyBehaviour('switch'))
    const undoDepth = editor.undo.undoLabel

    const id = editor.addBehaviourVariant(set.id, 'value', 'On')
    const variants = editor.graph.getChildren(set.id)
    expect(variants.map((variant) => variant.componentPropertyValues.On)).toEqual(['Off', 'On'])
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)?.booleans.value).toEqual({
      propertyId: id,
      on: 'On',
      off: 'Off'
    })

    editor.undo.undo()
    expect(editor.undo.undoLabel).toBe(undoDepth)
    expect(editor.graph.getChildren(set.id)).toHaveLength(1)
  })

  test('a slider gets a new slot frame for a missing part', () => {
    const { editor, component, behaviour } = bareComponent('slider')
    const id = editor.addBehaviourPart(component.id, 'track', 'Track')
    const frame = editor.graph.getChildren(component.id).find((child) => child.name === 'Track')
    expect(frame?.componentPropertyReferences).toEqual([{ propertyId: id, field: 'SLOT_CONTENT' }])
    expect(behaviour()?.parts.track).toBe(id)
    editor.undo.undo()
    expect(editor.graph.getChildren(component.id).map((child) => child.name)).toEqual(['Box'])
  })

  test('a lone slider gets state variants as a new set that keeps its behaviour, in one step', () => {
    const { editor, component } = bareComponent('slider')
    const track = editor.addBehaviourPart(component.id, 'track', 'Track')
    const page = editor.state.currentPageId
    const undoDepth = editor.undo.undoLabel

    const id = editor.addBehaviourStates(component.id)
    const set = editor.graph.getNode(component.parentId ?? '')
    if (set?.type !== 'COMPONENT_SET' || !id) throw new Error('No set')
    const variants = editor.graph.getChildren(set.id)
    expect(variants.map((variant) => variant.componentPropertyValues.State)).toEqual([
      'Default',
      'Hover',
      'Pressed',
      'Focus',
      'Disabled'
    ])
    // Laid out side by side, inside the set.
    expect(new Set(variants.map((variant) => variant.x)).size).toBe(5)
    expect(set.width).toBeGreaterThan(5 * component.width)
    expect(readBehaviour(editor.graph.getNode(component.id) ?? component)).toBeNull()
    const behaviour = readBehaviour(set)
    expect(behaviour?.parts.track).toBe(track)
    expect(behaviour?.states).toEqual({
      propertyId: id,
      rest: 'Default',
      hover: 'Hover',
      pressed: 'Pressed',
      focus: 'Focus',
      disabled: 'Disabled'
    })

    editor.undo.undo()
    expect(editor.undo.undoLabel).toBe(undoDepth)
    expect(editor.graph.getNode(set.id)).toBeUndefined()
    expect(editor.graph.getNode(component.id)?.parentId).toBe(page)
    expect(readBehaviour(editor.graph.getNode(component.id) ?? component)?.parts.track).toBe(track)
  })

  test('a states property takes a free name when the set already has State', () => {
    const editor = createEditor()
    const set = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, {
      name: 'Switch'
    })
    editor.graph.createNode('COMPONENT', set.id, { name: 'Default', width: 40, height: 20 })
    editor.setBehaviour(set.id, emptyBehaviour('switch'))
    editor.addBehaviourVariant(set.id, 'value', 'State')
    editor.addBehaviourStates(set.id)
    const names = editor.graph.getNode(set.id)?.componentPropertyDefinitions.map((item) => item.name)
    expect(names).toEqual(['State', 'Interaction'])
    expect(editor.graph.getChildren(set.id)).toHaveLength(10)
  })

  test('a lone switch gets Off and On variants as a new set', () => {
    const { editor, component } = bareComponent('switch')
    const id = editor.addBehaviourVariant(component.id, 'value', 'On')
    const set = editor.graph.getNode(component.parentId ?? '')
    expect(set?.type).toBe('COMPONENT_SET')
    expect(set && readBehaviour(set)?.booleans.value).toEqual({ propertyId: id, on: 'On', off: 'Off' })
  })

  test('a part added to a set is one slot in every variant', () => {
    const { editor, component } = bareComponent('slider')
    editor.addBehaviourStates(component.id)
    const set = editor.graph.getNode(component.parentId ?? '')
    if (!set) throw new Error('No set')
    const id = editor.addBehaviourPart(set.id, 'thumb', 'Thumb')
    const slots = editor.graph
      .getChildren(set.id)
      .map((variant) => editor.graph.getChildren(variant.id).find((child) => child.name === 'Thumb'))
    expect(slots).toHaveLength(5)
    for (const slot of slots)
      expect(slot?.componentPropertyReferences).toEqual([{ propertyId: id, field: 'SLOT_CONTENT' }])
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)?.parts.thumb).toBe(id)
  })
})
