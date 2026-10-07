import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

// Recorded in Figma desktop 126: a layer made on the canvas is numbered one past the highest
// number any layer on the page has with its name, whatever that layer is; booleans are not.

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((name, i) =>
    editor.graph.createNode('RECTANGLE', pageId, { name, x: i * 100, width: 40, height: 40 })
  )
  const name = () => editor.graph.getNode([...editor.state.selectedIds][0] ?? '')?.name
  return { editor, pageId, nodes, name }
}

describe('canvas layer names', () => {
  test('drawn layers are numbered per name', () => {
    const { editor, pageId } = setup()
    const names = (['RECTANGLE', 'RECTANGLE', 'FRAME', 'ELLIPSE', 'SECTION'] as const).map(
      (type) => editor.graph.getNode(editor.createShape(type, 0, 0, 10, 10, pageId))?.name
    )
    expect(names).toEqual(['Rectangle 1', 'Rectangle 2', 'Frame 1', 'Ellipse 1', 'Section 1'])
  })

  test('groups, frames, and components count past the highest number on the page', () => {
    const { editor, pageId, nodes, name } = setup()
    const [a, b, c, d, e, f] = nodes
    const frame = editor.graph.createNode('FRAME', pageId, { name: 'Other' })
    editor.graph.createNode('RECTANGLE', frame.id, { name: 'Group 9' })

    editor.select([a.id, b.id])
    editor.groupSelected()
    expect(name()).toBe('Group 10')
    editor.select([c.id, d.id])
    editor.frameSelection()
    expect(name()).toBe('Frame 1')
    editor.select([e.id, f.id])
    editor.createComponentFromSelection()
    expect(name()).toBe('Component 1')
  })

  test('booleans are named after the operation, without a number', () => {
    const { editor, nodes, name } = setup()
    editor.select([nodes[0].id, nodes[1].id])
    editor.booleanOperationSelected('UNION')
    expect(name()).toBe('Union')
  })
})
