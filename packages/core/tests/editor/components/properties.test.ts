import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function childByName(editor: ReturnType<typeof createEditor>, parentId: string, name: string) {
  return editor.graph.getChildren(parentId).find((node) => node.name === name)
}

function setupComponentProperties() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const iconA = editor.graph.createNode('COMPONENT', pageId, { name: 'Icon A' })
  editor.graph.createNode('RECTANGLE', iconA.id, { name: 'A shape' })
  const iconB = editor.graph.createNode('COMPONENT', pageId, { name: 'Icon B' })
  editor.graph.createNode('ELLIPSE', iconB.id, { name: 'B shape' })
  const component = editor.graph.createNode('COMPONENT', pageId, {
    name: 'Card',
    componentPropertyDefinitions: [
      { id: '10:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' },
      { id: '10:2', name: 'Show icon', type: 'BOOLEAN', defaultValue: 'true' },
      { id: '10:3', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: iconA.id }
    ]
  })
  editor.graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: 'Default',
    componentPropertyReferences: [{ propertyId: '10:1', field: 'TEXT' }]
  })
  editor.graph.createNode('FRAME', component.id, {
    name: 'Badge',
    componentPropertyReferences: [{ propertyId: '10:2', field: 'VISIBLE' }]
  })
  const sourceIcon = editor.graph.createInstance(iconA.id, component.id, { name: 'Icon' })
  if (!sourceIcon) throw new Error('Expected nested source instance')
  editor.graph.updateNode(sourceIcon.id, {
    componentPropertyReferences: [{ propertyId: '10:3', field: 'INSTANCE_SWAP' }]
  })
  const instance = editor.graph.createInstance(component.id, pageId)
  if (!instance) throw new Error('Expected card instance')
  return { editor, component, instance, iconA, iconB }
}

describe('component property actions', () => {
  test('applies and undoes text, boolean, and instance-swap properties', () => {
    const { editor, instance, iconA, iconB } = setupComponentProperties()

    editor.setInstanceComponentProperty(instance.id, '10:1', 'Changed')
    expect(childByName(editor, instance.id, 'Label')?.text).toBe('Changed')
    expect(editor.graph.getNode(instance.id)?.componentPropertyAssignments['10:1']).toBe('Changed')
    editor.undo.undo()
    expect(childByName(editor, instance.id, 'Label')?.text).toBe('Default')

    editor.setInstanceComponentProperty(instance.id, '10:2', 'false')
    expect(childByName(editor, instance.id, 'Badge')?.visible).toBe(false)
    editor.undo.undo()
    expect(childByName(editor, instance.id, 'Badge')?.visible).toBe(true)

    editor.setInstanceComponentProperty(instance.id, '10:3', iconB.id)
    const swapped = childByName(editor, instance.id, 'Icon B')
    expect(swapped?.componentId).toBe(iconB.id)
    expect(swapped?.childIds.map((id) => editor.graph.getNode(id)?.name)).toEqual(['B shape'])
    editor.setInstanceComponentProperty(instance.id, '10:3', iconA.id)
    editor.undo.undo()
    expect(childByName(editor, instance.id, 'Icon B')?.componentId).toBe(iconB.id)
    editor.undo.undo()
    const restored = childByName(editor, instance.id, 'Icon A')
    expect(restored?.componentId).toBe(iconA.id)
    expect(restored?.childIds.map((id) => editor.graph.getNode(id)?.name)).toEqual(['A shape'])
  })

  test('preserves assignments when the main component synchronizes', () => {
    const { editor, component, instance, iconB } = setupComponentProperties()
    editor.setInstanceComponentProperty(instance.id, '10:1', 'Custom')
    editor.setInstanceComponentProperty(instance.id, '10:2', 'false')
    editor.setInstanceComponentProperty(instance.id, '10:3', iconB.id)

    const sourceLabel = childByName(editor, component.id, 'Label')
    if (!sourceLabel) throw new Error('Expected source label')
    editor.graph.updateNode(sourceLabel.id, { text: 'Updated default' })
    editor.graph.syncInstances(component.id)

    expect(childByName(editor, instance.id, 'Label')?.text).toBe('Custom')
    expect(childByName(editor, instance.id, 'Badge')?.visible).toBe(false)
    const nestedInstances = editor.graph
      .getChildren(instance.id)
      .filter((node) => node.type === 'INSTANCE')
    expect(nestedInstances).toHaveLength(1)
    expect(nestedInstances[0].name).toBe('Icon B')
    expect(nestedInstances[0].childIds.map((id) => editor.graph.getNode(id)?.name)).toEqual([
      'B shape'
    ])
  })

  test('reapplies non-variant assignments after variant swaps and undo', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const componentSet = editor.graph.createNode('COMPONENT_SET', pageId, {
      componentPropertyDefinitions: [
        { id: '20:1', name: 'State', type: 'VARIANT', defaultValue: 'A' },
        { id: '20:2', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
      ]
    })
    const variantA = editor.graph.createNode('COMPONENT', componentSet.id, {
      name: 'State=A',
      componentPropertyValues: { State: 'A' }
    })
    editor.graph.createNode('TEXT', variantA.id, {
      name: 'Label',
      text: 'A default',
      componentPropertyReferences: [{ propertyId: '20:2', field: 'TEXT' }]
    })
    const variantB = editor.graph.createNode('COMPONENT', componentSet.id, {
      name: 'State=B',
      componentPropertyValues: { State: 'B' }
    })
    editor.graph.createNode('TEXT', variantB.id, {
      name: 'Label',
      text: 'B default',
      componentPropertyReferences: [{ propertyId: '20:2', field: 'TEXT' }]
    })
    const instance = editor.graph.createInstance(variantA.id, pageId)
    if (!instance) throw new Error('Expected variant instance')

    editor.setInstanceComponentProperty(instance.id, '20:2', 'Custom')
    editor.setInstanceComponentProperty(instance.id, '20:1', 'B')
    expect(editor.graph.getNode(instance.id)?.componentId).toBe(variantB.id)
    expect(childByName(editor, instance.id, 'Label')?.text).toBe('Custom')

    editor.undo.undo()
    expect(editor.graph.getNode(instance.id)?.componentId).toBe(variantA.id)
    expect(childByName(editor, instance.id, 'Label')?.text).toBe('Custom')
  })
})
