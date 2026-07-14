import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { computeAllLayouts } from '@open-pencil/core/layout'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { flushComponentSync } from '#tests/helpers/component-sync'
import { autoFrame, rect } from '#tests/helpers/layout'

describe('deleteSelected', () => {
  test('reflows fixed vertical auto-layout siblings', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const frame = autoFrame(editor.graph, page, {
      layoutMode: 'VERTICAL',
      width: 300,
      height: 300,
      itemSpacing: 0
    })
    rect(editor.graph, frame.id, 300, 40)
    const body = rect(editor.graph, frame.id, 300, 100, { layoutGrow: 1 })
    const footerA = rect(editor.graph, frame.id, 300, 40)
    const footerB = rect(editor.graph, frame.id, 300, 40)
    computeAllLayouts(editor.graph, page)

    editor.select([footerB.id])
    editor.deleteSelected()

    expect(getNodeOrThrow(editor.graph, body.id).height).toBe(220)
    expect(getNodeOrThrow(editor.graph, footerA.id).y).toBe(260)
  })

  test('undo restores mapped instance child identity and overrides after component-child delete sync', async () => {
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
    const componentChild = rect(editor.graph, component.id, 100, 40, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })
    const instance = editor.graph.createInstance(component.id, page)
    if (!instance) throw new Error('Expected instance')
    computeAllLayouts(editor.graph, page)

    const instanceChildId = getNodeOrThrow(editor.graph, instance.id).childIds[0]
    if (!instanceChildId) throw new Error('Expected instance child')
    editor.graph.updateNode(instanceChildId, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    getNodeOrThrow(editor.graph, instance.id).overrides[`${instanceChildId}:fills`] = true

    editor.select([componentChild.id])
    editor.deleteSelected()
    await flushComponentSync()

    expect(getNodeOrThrow(editor.graph, instance.id).childIds).toHaveLength(0)

    editor.undoAction()
    await flushComponentSync()

    const restoredInstance = getNodeOrThrow(editor.graph, instance.id)
    expect(restoredInstance.childIds).toEqual([instanceChildId])
    expect(restoredInstance.overrides[`${instanceChildId}:fills`]).toBe(true)
    const restoredChild = getNodeOrThrow(editor.graph, instanceChildId)
    expect(restoredChild.componentId).toBe(componentChild.id)
    expect(restoredChild.fills[0]?.type).toBe('SOLID')
    expect(restoredChild.fills[0]?.color).toEqual({ r: 0, g: 0, b: 1, a: 1 })
  })
})
