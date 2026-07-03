import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { computeAllLayouts } from '@open-pencil/core/layout'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { rect } from '#tests/helpers/layout'

async function flushComponentSync(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('structure state actions', () => {
  test('toggleNodeVisibility reflows HUG auto-layout instance slots', async () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', page, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 300,
      height: 1,
      itemSpacing: 0
    })
    rect(editor.graph, component.id, 300, 40, { name: 'Slot / Pinned at Top' })
    rect(editor.graph, component.id, 300, 74, { name: 'Slot / Content' })
    rect(editor.graph, component.id, 300, 40, { name: 'Slot / Pinned at Bottom' })
    const instance = editor.graph.createInstance(component.id, page)
    if (!instance) throw new Error('Expected instance')
    computeAllLayouts(editor.graph, page)

    const content = editor.graph
      .getChildren(instance.id)
      .find((child) => child.name === 'Slot / Content')
    const bottom = editor.graph
      .getChildren(instance.id)
      .find((child) => child.name === 'Slot / Pinned at Bottom')
    if (!content || !bottom) throw new Error('Expected instance slot children')

    editor.toggleNodeVisibility(content.id)

    expect(getNodeOrThrow(editor.graph, instance.id).height).toBe(80)
    expect(getNodeOrThrow(editor.graph, bottom.id).y).toBe(40)

    await Promise.resolve()

    expect(getNodeOrThrow(editor.graph, instance.id).height).toBe(80)
    expect(getNodeOrThrow(editor.graph, bottom.id).y).toBe(40)
  })

  test('component sync replays cascaded sync scheduled during layout flush', async () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const componentA = editor.graph.createNode('COMPONENT', page, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 1,
      itemSpacing: 0
    })
    const componentAChild = rect(editor.graph, componentA.id, 100, 40)
    const componentB = editor.graph.createNode('COMPONENT', page, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 1,
      itemSpacing: 0
    })
    const nestedInstance = editor.graph.createInstance(componentA.id, componentB.id)
    const outerInstance = editor.graph.createInstance(componentB.id, page)
    if (!nestedInstance || !outerInstance) throw new Error('Expected nested component instances')
    computeAllLayouts(editor.graph, page)

    expect(getNodeOrThrow(editor.graph, outerInstance.id).height).toBe(40)

    editor.graph.updateNode(componentAChild.id, { height: 80 })
    await flushComponentSync()

    expect(getNodeOrThrow(editor.graph, nestedInstance.id).height).toBe(80)
    expect(getNodeOrThrow(editor.graph, componentB.id).height).toBe(80)
    expect(getNodeOrThrow(editor.graph, outerInstance.id).height).toBe(80)
  })

  test('deleting component children removes mapped instance children', async () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', page, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 1,
      itemSpacing: 0
    })
    rect(editor.graph, component.id, 100, 40, { name: 'Kept slot' })
    const removed = rect(editor.graph, component.id, 100, 40, { name: 'Removed slot' })
    const instance = editor.graph.createInstance(component.id, page)
    if (!instance) throw new Error('Expected instance')
    computeAllLayouts(editor.graph, page)

    expect(editor.graph.getChildren(instance.id)).toHaveLength(2)

    editor.select([removed.id])
    editor.deleteSelected()
    await flushComponentSync()

    const instanceChildren = editor.graph.getChildren(instance.id)
    expect(instanceChildren).toHaveLength(1)
    expect(instanceChildren.some((child) => child.componentId === removed.id)).toBe(false)
  })

  test('deleting nested component children removes mapped instance descendants', async () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', page, {
      width: 140,
      height: 80
    })
    const slot = editor.graph.createNode('FRAME', component.id, {
      name: 'Nested slot',
      x: 0,
      y: 0,
      width: 140,
      height: 80
    })
    const removed = rect(editor.graph, slot.id, 80, 40, { name: 'Nested removed child' })
    const instance = editor.graph.createInstance(component.id, page)
    if (!instance) throw new Error('Expected instance')
    computeAllLayouts(editor.graph, page)

    const firstInstanceChildId = getNodeOrThrow(editor.graph, instance.id).childIds[0]
    if (!firstInstanceChildId) throw new Error('Expected instance slot child')
    const instanceSlot = getNodeOrThrow(editor.graph, firstInstanceChildId)
    expect(instanceSlot.componentId).toBe(slot.id)
    expect(editor.graph.getChildren(instanceSlot.id)).toHaveLength(1)

    editor.select([removed.id])
    editor.deleteSelected()
    await flushComponentSync()

    expect(editor.graph.getChildren(instanceSlot.id)).toHaveLength(0)
  })

  test('runLayoutForNode explicitly reflows edited imported fig instances', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const importedInstance = editor.graph.createNode('INSTANCE', page, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 1,
      itemSpacing: 0
    })
    importedInstance.source.format = 'fig'
    rect(editor.graph, importedInstance.id, 100, 40)
    rect(editor.graph, importedInstance.id, 100, 60)

    computeAllLayouts(editor.graph, page)
    expect(getNodeOrThrow(editor.graph, importedInstance.id).height).toBe(1)

    editor.updateNode(importedInstance.id, { itemSpacing: 0 })

    expect(getNodeOrThrow(editor.graph, importedInstance.id).height).toBe(100)
  })

  test('parent relayout preserves unrelated imported fig instance layout', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const importedInstance = editor.graph.createNode('INSTANCE', page, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 1,
      itemSpacing: 0
    })
    importedInstance.source.format = 'fig'
    rect(editor.graph, importedInstance.id, 100, 40)
    rect(editor.graph, importedInstance.id, 100, 60)
    const unrelated = rect(editor.graph, page, 10, 10, { name: 'Unrelated sibling' })

    computeAllLayouts(editor.graph, page)
    expect(getNodeOrThrow(editor.graph, importedInstance.id).height).toBe(1)

    editor.toggleNodeVisibility(unrelated.id)

    expect(getNodeOrThrow(editor.graph, importedInstance.id).height).toBe(1)
  })

  test('global relayout preserves auto-layout descendants inside imported fig instances', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const importedInstance = editor.graph.createNode('INSTANCE', page, {
      width: 300,
      height: 300
    })
    importedInstance.source.format = 'fig'
    const wrapper = editor.graph.createNode('FRAME', importedInstance.id, {
      name: 'Unpainted imported auto-layout wrapper',
      x: 10,
      y: 20,
      width: 280,
      height: 44,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      figmaDerivedLayout: null
    })
    rect(editor.graph, wrapper.id, 100, 100, { visible: false })
    rect(editor.graph, wrapper.id, 50, 30)

    computeAllLayouts(editor.graph, page)

    const preserved = getNodeOrThrow(editor.graph, wrapper.id)
    expect(preserved.x).toBe(10)
    expect(preserved.y).toBe(20)
    expect(preserved.width).toBe(280)
    expect(preserved.height).toBe(44)
  })

  test('direct imported fig instance relayout can reflow imported descendants', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const importedInstance = editor.graph.createNode('INSTANCE', page, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 300,
      height: 1,
      itemSpacing: 0
    })
    importedInstance.source.format = 'fig'
    const wrapper = editor.graph.createNode('FRAME', importedInstance.id, {
      name: 'Editable imported auto-layout wrapper',
      x: 10,
      y: 20,
      width: 280,
      height: 44,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      figmaDerivedLayout: null
    })
    rect(editor.graph, wrapper.id, 100, 100, { visible: false })
    rect(editor.graph, wrapper.id, 50, 30)
    computeAllLayouts(editor.graph, page)
    expect(getNodeOrThrow(editor.graph, wrapper.id).height).toBe(44)

    editor.updateNode(importedInstance.id, { itemSpacing: 0 })

    const reflowed = getNodeOrThrow(editor.graph, wrapper.id)
    expect(reflowed.width).toBe(50)
    expect(reflowed.height).toBe(30)
    expect(getNodeOrThrow(editor.graph, importedInstance.id).height).toBe(30)
  })
})
