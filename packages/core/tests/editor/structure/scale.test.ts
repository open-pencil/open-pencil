import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { EDITOR_TOOLS, TOOL_SHORTCUTS } from '@open-pencil/core'

let editor: Editor

afterEach(() => editor?.dispose())

test('Scale is K and sits in the Move flyout', () => {
  expect(TOOL_SHORTCUTS.K).toBe('SCALE')
  expect(EDITOR_TOOLS.find((tool) => tool.key === 'SELECT')?.flyout).toContain('SCALE')
})

function setup() {
  editor = createEditor()
  const page = editor.state.currentPageId
  const text = editor.graph.createNode('TEXT', page, {
    x: 100,
    y: 50,
    width: 200,
    height: 80,
    text: 'Hello',
    fontSize: 20,
    strokeWeight: 2
  })
  return { text }
}

function current(id: string) {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error('missing layer')
  return node
}

describe('scaleSelected', () => {
  test('scales a text layer font size and stroke weight as one undo step', () => {
    const { text } = setup()

    editor.scaleSelected(
      [current(text.id)],
      2,
      { x: 100, y: 50, width: 200, height: 80 },
      { x: 100, y: 50, width: 400, height: 160 }
    )

    expect(current(text.id).fontSize).toBe(40)
    expect(current(text.id).strokeWeight).toBe(4)
    expect(current(text.id).width).toBe(400)

    editor.undo.undo()
    expect(current(text.id).fontSize).toBe(20)
    expect(current(text.id).strokeWeight).toBe(2)
    expect(current(text.id).width).toBe(200)
  })

  test('scales an auto layout frame padding, gap, and text', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', page, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      layoutMode: 'VERTICAL',
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingLeft: 10,
      itemSpacing: 10
    })
    const text = editor.graph.createNode('TEXT', frame.id, {
      x: 10,
      y: 10,
      width: 80,
      height: 20,
      text: 'Hi',
      fontSize: 10
    })

    editor.scaleSelected(
      [current(frame.id)],
      2,
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 200 }
    )

    expect(current(frame.id).paddingTop).toBe(20)
    expect(current(frame.id).itemSpacing).toBe(20)
    expect(current(text.id).fontSize).toBe(20)
  })

  test('scales a multi-selection around the box anchor', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const left = editor.graph.createNode('RECTANGLE', page, {
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    const right = editor.graph.createNode('RECTANGLE', page, {
      x: 100,
      y: 0,
      width: 50,
      height: 50
    })

    editor.scaleSelected(
      [current(left.id), current(right.id)],
      2,
      { x: 0, y: 0, width: 150, height: 50 },
      { x: 0, y: 0, width: 300, height: 100 }
    )

    expect([current(left.id).x, current(left.id).width]).toEqual([0, 100])
    expect([current(right.id).x, current(right.id).width]).toEqual([200, 100])
  })
})
