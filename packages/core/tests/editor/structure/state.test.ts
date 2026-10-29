import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'
import { rect } from '#core-tests/helpers/layout'

import { createEditor } from '@open-pencil/core'
import { computeAllLayouts } from '@open-pencil/core/layout'

describe('structure state actions', () => {
  test('hiding a layer refits its group, and undo puts the group back', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const a = rect(editor.graph, page, 50, 50)
    const b = rect(editor.graph, page, 30, 30, { x: 100, y: 100 })
    editor.select([a.id, b.id])
    editor.groupSelected()
    const group = getNodeOrThrow(editor.graph, [...editor.state.selectedIds][0])
    const box = () => {
      const { x, y, width, height } = getNodeOrThrow(editor.graph, group.id)
      return [x, y, width, height]
    }
    expect(box()).toEqual([0, 0, 130, 130])

    editor.toggleNodeVisibility(b.id)
    expect(box()).toEqual([0, 0, 50, 50])
    editor.setNodeVisibility(a.id, false)
    expect(box()).toEqual([0, 0, 0, 0])

    editor.undo.undo()
    editor.undo.undo()
    expect(box()).toEqual([0, 0, 130, 130])
    expect(getNodeOrThrow(editor.graph, b.id)).toMatchObject({ x: 100, y: 100, visible: true })
  })

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
})
