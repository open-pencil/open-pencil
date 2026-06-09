import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function pageId(editor: ReturnType<typeof createEditor>): string {
  return editor.graph.getPages()[0].id
}

function setupColorVar(editor: ReturnType<typeof createEditor>, id: string): void {
  editor.graph.addCollection({
    id: 'col1',
    name: 'Colors',
    modes: [{ modeId: 'm1', name: 'Light' }],
    defaultModeId: 'm1',
    variableIds: []
  })
  editor.graph.addVariable({
    id,
    name: `Var ${id}`,
    type: 'COLOR',
    collectionId: 'col1',
    valuesByMode: { m1: { r: 0.5, g: 0.5, b: 0.5, a: 1 } },
    description: '',
    hiddenFromPublishing: false
  })
}

describe('variable-bindings undo resilience', () => {
  test('bindVariable undo restores previous binding when variable still exists', () => {
    const editor = createEditor()
    setupColorVar(editor, 'v1')
    setupColorVar(editor, 'v2')
    const page = pageId(editor)
    const node = editor.graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    editor.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBe('v1')

    editor.bindVariable(node.id, 'fills/0/color', 'v2')
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBe('v2')

    editor.undo.undo()
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBe('v1')
  })

  test('bindVariable undo gracefully degrades when variable was deleted', () => {
    const editor = createEditor()
    setupColorVar(editor, 'v1')
    const page = pageId(editor)
    const node = editor.graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    editor.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBe('v1')

    // Delete the variable after binding — binding entry remains on the node
    editor.graph.removeVariable('v1')

    editor.undo.undo()
    // Undo should not throw — graceful degradation: binding is simply not restored
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
  })

  test('unbindVariable undo gracefully degrades when variable was deleted', () => {
    const editor = createEditor()
    setupColorVar(editor, 'v1')
    const page = pageId(editor)
    const node = editor.graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    editor.bindVariable(node.id, 'fills/0/color', 'v1')
    editor.unbindVariable(node.id, 'fills/0/color')
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()

    // Delete the variable after unbinding — the undo inverse will try to rebind it
    editor.graph.removeVariable('v1')

    editor.undo.undo()
    // Undo should not throw — graceful degradation: binding is simply not restored
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
  })

  test('bindVariable undo with prev binding restore when variable still exists', () => {
    const editor = createEditor()
    setupColorVar(editor, 'v1')
    const page = pageId(editor)
    const node = editor.graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      fills: [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 },
        { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, visible: true, opacity: 1 }
      ]
    })

    // Pre-bind the second fill
    editor.bindVariable(node.id, 'fills/1/color', 'v1')
    expect(editor.graph.getNode(node.id).boundVariables['fills/1/color']).toBe('v1')

    // Bind the first fill (no previous binding)
    editor.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBe('v1')

    editor.undo.undo()
    // Should restore the pre-existing binding on fills/1
    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
    expect(editor.graph.getNode(node.id).boundVariables['fills/1/color']).toBe('v1')
  })

  test('bindVariable redo gracefully degrades when variable was deleted', () => {
    const editor = createEditor()
    setupColorVar(editor, 'v1')
    const page = pageId(editor)
    const node = editor.graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    editor.bindVariable(node.id, 'fills/0/color', 'v1')
    editor.undo.undo()

    editor.graph.removeVariable('v1')

    editor.undo.redo()

    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
  })

  test('unbindVariable redo gracefully degrades when variable was deleted', () => {
    const editor = createEditor()
    setupColorVar(editor, 'v1')
    const page = pageId(editor)
    const node = editor.graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    editor.bindVariable(node.id, 'fills/0/color', 'v1')
    editor.unbindVariable(node.id, 'fills/0/color')
    editor.undo.undo()

    editor.graph.removeVariable('v1')

    editor.undo.redo()

    expect(editor.graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
  })
})
