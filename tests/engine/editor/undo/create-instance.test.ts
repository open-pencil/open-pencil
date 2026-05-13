import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { expectDefined } from '#tests/helpers/assert'

describe('create instance undo/redo', () => {
  test('undo restores the previous selection instead of selecting the source component', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', pageId, {
      name: 'Library Button',
      width: 100,
      height: 40,
      internalOnly: true
    })
    const previous = editor.graph.createNode('RECTANGLE', pageId, { name: 'Previous selection' })

    editor.select([previous.id])
    const instanceId = expectDefined(
      editor.createInstanceFromComponent(component.id, 200, 100, pageId),
      'instanceId'
    )

    expect([...editor.state.selectedIds]).toEqual([instanceId])

    editor.undo.undo()

    expect(editor.graph.getNode(instanceId)).toBeUndefined()
    expect([...editor.state.selectedIds]).toEqual([previous.id])
  })
})
