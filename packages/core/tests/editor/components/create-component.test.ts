import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

// Recorded in Figma desktop 126 with Create component from the canvas.

const WHITE = { r: 1, g: 1, b: 1, a: 1 }

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((name, i) =>
    editor.graph.createNode('RECTANGLE', pageId, { name, x: i * 100, width: 50, height: 50 })
  )
  const order = () => editor.graph.getChildren(pageId).map((node) => node.name)
  const created = () => editor.graph.getNode([...editor.state.selectedIds][0] ?? '')
  return { editor, a, b, c, d, order, created }
}

describe('createComponentFromSelection', () => {
  test('wraps one layer in a white component named after it, in its place', () => {
    const { editor, b, order, created } = setup()
    editor.select([b.id])
    editor.createComponentFromSelection()
    const component = created()
    expect(component?.type).toBe('COMPONENT')
    expect(component?.name).toBe('b')
    expect(component?.fills.map((fill) => fill.color)).toEqual([WHITE])
    expect(component?.childIds).toEqual([b.id])
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  test('wraps several layers in a white component in the topmost one’s place', () => {
    const { editor, a, c, order, created } = setup()
    editor.select([a.id, c.id])
    editor.createComponentFromSelection()
    const component = created()
    expect(component?.name).toBe('Component')
    expect(component?.fills.map((fill) => fill.color)).toEqual([WHITE])
    expect(order()).toEqual(['b', 'Component', 'd'])
  })

  test('turns a group into the component in place, keeping its look', () => {
    const { editor, b, c, order, created } = setup()
    editor.select([b.id, c.id])
    editor.groupSelected()
    editor.createComponentFromSelection()
    const component = created()
    expect(component?.type).toBe('COMPONENT')
    expect(component?.fills).toEqual([])
    expect(component?.childIds).toEqual([b.id, c.id])
    expect(order()).toEqual(['a', 'Group', 'd'])
  })
})
