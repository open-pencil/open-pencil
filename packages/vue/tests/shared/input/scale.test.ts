import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

import { applyScale, tryStartScale } from '#vue/shared/input/scale'

let editor: Editor

afterEach(() => editor.dispose())

function textLayer() {
  editor = createEditor()
  const page = editor.state.currentPageId
  const node = editor.graph.createNode('TEXT', page, {
    x: 100,
    y: 50,
    width: 200,
    height: 80,
    text: 'Hello',
    fontSize: 20,
    strokeWeight: 2
  })
  editor.select([node.id])
  return node.id
}

describe('scale tool input', () => {
  test('scales text and strokes from a corner handle', () => {
    const id = textLayer()
    const drag = tryStartScale(300, 130, editor)

    expect(drag).not.toBeNull()
    applyScale(drag!, 400, 160, editor)
    expect(editor.graph.getNode(id)?.fontSize).toBeCloseTo(30)

    drag!.commit()
    expect(editor.graph.getNode(id)?.fontSize).toBeCloseTo(30)
    expect(editor.graph.getNode(id)?.strokeWeight).toBeCloseTo(3)
  })

  test('cancelling puts the layer back', () => {
    const id = textLayer()
    const drag = tryStartScale(300, 130, editor)

    applyScale(drag!, 400, 160, editor)
    drag!.cancel()

    expect(editor.graph.getNode(id)?.fontSize).toBe(20)
    expect(editor.graph.getNode(id)?.width).toBe(200)
  })

  test('scales a multi-selection around its box', () => {
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
    editor.select([left.id, right.id])

    const drag = tryStartScale(150, 50, editor)

    expect(drag).not.toBeNull()
    applyScale(drag!, 300, 100, editor)
    drag!.commit()

    expect([editor.graph.getNode(left.id)?.x, editor.graph.getNode(left.id)?.width]).toEqual([
      0, 100
    ])
    expect([editor.graph.getNode(right.id)?.x, editor.graph.getNode(right.id)?.width]).toEqual([
      200, 100
    ])
  })
})
