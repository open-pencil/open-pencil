import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

type Editor = ReturnType<typeof createEditor>

function rectangles(editor: Editor, ...at: [number, number][]) {
  return at.map(
    ([x, y]) =>
      editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
        x,
        y,
        width: 100,
        height: 70
      }).id
  )
}

function positions(editor: Editor, ids: string[]) {
  return ids.map((id) => {
    const node = editor.graph.getNode(id)
    return [node?.x, node?.y]
  })
}

describe('editor arrange actions', () => {
  test('tidies a row in one undo step', () => {
    const editor = createEditor()
    const ids = rectangles(editor, [0, 0], [150, 10], [400, 0], [520, 5])

    editor.tidyNodes(ids)
    expect(positions(editor, ids)).toEqual([
      [0, 0],
      [173, 10],
      [346, 0],
      [519, 5]
    ])

    editor.undo.undo()
    expect(positions(editor, ids)).toEqual([
      [0, 0],
      [150, 10],
      [400, 0],
      [520, 5]
    ])
  })

  test('packs edge to edge along each axis', () => {
    const editor = createEditor()
    const ids = rectangles(editor, [300, 0], [0, 40], [120, 200])

    editor.packNodes(ids, 'horizontal')
    expect(positions(editor, ids)).toEqual([
      [200, 0],
      [0, 40],
      [100, 200]
    ])

    editor.packNodes(ids, 'vertical')
    expect(positions(editor, ids)).toEqual([
      [200, 0],
      [0, 70],
      [100, 140]
    ])
  })

  test('moves a chosen layer inside another chosen layer with it, once', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, { x: 300, width: 100, height: 70 })
    const inside = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 10,
      y: 10,
      width: 20,
      height: 20
    })
    const [first] = rectangles(editor, [0, 0])

    editor.packNodes([first, frame.id, inside.id], 'horizontal')

    expect(editor.graph.getNode(frame.id)?.x).toBe(100)
    expect(editor.graph.getNode(inside.id)).toMatchObject({ x: 10, y: 10 })
  })

  test('arranges nothing when the document is replaced while the layout runs', async () => {
    const editor = createEditor()
    const ids = rectangles(editor, [0, 0], [20, 10], [40, 20])
    const original = editor.graph

    const arranged = editor.arrangeNodes(ids, { layout: 'spread' })
    editor.replaceGraph(new SceneGraph())

    await expect(arranged).rejects.toThrow('document changed')
    expect(ids.map((id) => original.getNode(id)?.x)).toEqual([0, 20, 40])
    expect(editor.undo.canUndo).toBe(false)
  })

  test('only offers arranging for two or more movable layers', () => {
    const editor = createEditor()
    const [first, second] = rectangles(editor, [0, 0], [10, 10])

    expect(editor.canArrangeNodes([first])).toBe(false)
    expect(editor.canArrangeNodes([first, second])).toBe(true)
  })

  test('offers Auto Arrange only for layers sharing a parent', () => {
    const editor = createEditor()
    const [first, second] = rectangles(editor, [0, 0], [10, 10])
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 500,
      width: 200,
      height: 200
    })
    const inside = editor.graph.createNode('RECTANGLE', frame.id, { width: 50, height: 50 })

    expect(editor.canAutoArrangeNodes([first, second])).toBe(true)
    expect(editor.canAutoArrangeNodes([first, inside.id])).toBe(false)
    expect(editor.canArrangeNodes([first, inside.id])).toBe(true)
  })

  test('keeps an edit made while the layout runs out of the Arrange step', async () => {
    const editor = createEditor()
    const ids = rectangles(editor, [0, 0], [20, 10], [40, 20])
    const [other] = rectangles(editor, [900, 900])

    const arranged = editor.arrangeNodes(ids, { layout: 'spread' })
    editor.graph.updateNode(other, { x: 950 })
    await arranged

    expect(editor.undo.undo()).toBe('Arrange')
    expect(positions(editor, ids)).toEqual([
      [0, 0],
      [20, 10],
      [40, 20]
    ])
    expect(editor.graph.getNode(other)?.x).toBe(950)
  })

  test('records nothing when the layers change while the layout runs', async () => {
    const editor = createEditor()
    const ids = rectangles(editor, [0, 0], [20, 10], [40, 20])

    const arranged = editor.arrangeNodes(ids, { layout: 'spread' })
    editor.graph.updateNode(ids[0], { x: 300 })

    await expect(arranged).rejects.toThrow('changed while they were being arranged')
    expect(editor.undo.canUndo).toBe(false)
  })

  test('arranges overlapping layers apart and undoes it in one step', async () => {
    const editor = createEditor()
    const ids = rectangles(editor, [0, 0], [20, 10], [40, 20])

    await editor.arrangeNodes(ids, { layout: 'spread' })
    const [a, b, c] = ids.map((id) => editor.graph.getNode(id))
    const overlaps = (p = a, q = b) =>
      !!p && !!q && p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height
    expect([overlaps(a, b), overlaps(b, c), overlaps(a, c)]).toEqual([false, false, false])

    editor.undo.undo()
    expect(positions(editor, ids)).toEqual([
      [0, 0],
      [20, 10],
      [40, 20]
    ])
  })
})
