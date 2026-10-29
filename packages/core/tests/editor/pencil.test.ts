import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import type { Vector } from '@open-pencil/scene-graph/primitives'

type Editor = ReturnType<typeof createEditor>

const DARK_PAGE = { r: 0.118, g: 0.118, b: 0.118, a: 1 }

function sine(x0 = 0, y0 = 0) {
  return Array.from({ length: 61 }, (_, i) => ({
    x: x0 + 5 * i,
    y: y0 + 40 * Math.sin((i / 60) * 2 * Math.PI)
  }))
}

function draw(
  editor: Editor,
  points: Vector[],
  { parentId, shift = false }: { parentId?: string; shift?: boolean } = {}
) {
  const [first, ...rest] = points
  editor.pencilBegin(first.x, first.y)
  for (const point of rest) editor.pencilAddPoint(point.x, point.y, shift)
  return editor.pencilCommit(parentId)
}

function pencilEditor() {
  const editor = createEditor()
  editor.setTool('PENCIL')
  return editor
}

// Behaviour measured live in Figma desktop's pencil.
describe('pencil', () => {
  test('draws an outlined, numbered vector and stays on the pencil with nothing selected', () => {
    const editor = pencilEditor()
    const id = draw(editor, sine())
    if (!id) throw new Error('nothing drawn')
    const node = getNodeOrThrow(editor.graph, id)

    expect(node.type).toBe('VECTOR')
    expect(node.name).toBe('Vector 1')
    expect(node.fills).toEqual([])
    expect(node.strokes).toHaveLength(1)
    expect(node.strokes[0]).toMatchObject({ weight: 2, align: 'CENTER' })
    expect(node.strokeCap).toBe('ROUND')
    expect(node.strokeJoin).toBe('ROUND')
    expect(node.vectorNetwork?.regions).toEqual([])
    expect(node.vectorNetwork?.vertices.every((v) => v.handleMirroring === 'ANGLE')).toBe(true)
    expect({ x: node.x, y: node.y, width: node.width }).toMatchObject({ x: 0, width: 300 })
    expect(editor.state.selectedIds.size).toBe(0)
    expect(editor.state.activeTool).toBe('PENCIL')
    expect(editor.state.pencilState).toBeNull()

    const second = draw(editor, sine(0, 100))
    expect(second && getNodeOrThrow(editor.graph, second).name).toBe('Vector 2')
  })

  test('draws nothing for a press without movement', () => {
    const editor = pencilEditor()
    const before = editor.graph.getChildren(editor.state.currentPageId).length
    expect(draw(editor, [{ x: 50, y: 50 }])).toBeNull()
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(before)
  })

  test('keeps more detail when drawn zoomed in', () => {
    const vertices = (zoom: number) => {
      const editor = pencilEditor()
      editor.state.zoom = zoom
      const id = draw(editor, sine())
      return id ? (getNodeOrThrow(editor.graph, id).vectorNetwork?.vertices.length ?? 0) : 0
    }
    expect(vertices(0.5)).toBeLessThan(vertices(1))
    expect(vertices(1)).toBeLessThan(vertices(2))
  })

  test('collapses a straight stroke to one segment', () => {
    const editor = pencilEditor()
    const id = draw(
      editor,
      Array.from({ length: 101 }, (_, i) => ({ x: 3 * i, y: 0 }))
    )
    const network = id ? getNodeOrThrow(editor.graph, id).vectorNetwork : undefined
    expect(network?.vertices).toHaveLength(2)
    expect(network?.segments[0]?.tangentStart).toEqual({ x: 0, y: 0 })
  })

  test('draws straight along the nearer axis while Shift is held', () => {
    const editor = pencilEditor()
    const id = draw(
      editor,
      Array.from({ length: 60 }, (_, i) => ({ x: 3 * i, y: 3 * i * Math.tan(Math.PI / 9) })),
      { shift: true }
    )
    const node = id ? getNodeOrThrow(editor.graph, id) : undefined
    expect(node?.vectorNetwork?.vertices.map((v) => v.y)).toEqual([0, 0])
    expect(node?.width).toBe(177)

    const vertical = draw(
      editor,
      Array.from({ length: 60 }, (_, i) => ({ x: 3 * i * 0.5, y: 3 * i })),
      { shift: true }
    )
    expect(vertical && getNodeOrThrow(editor.graph, vertical).width).toBe(0)
  })

  test('closes a stroke that ends where it started, without a fill', () => {
    const editor = pencilEditor()
    const circle = Array.from({ length: 73 }, (_, t) => ({
      x: 80 * Math.cos((t * 2 * Math.PI) / 72),
      y: 80 * Math.sin((t * 2 * Math.PI) / 72)
    }))
    const id = draw(editor, circle)
    const network = id ? getNodeOrThrow(editor.graph, id).vectorNetwork : undefined
    expect(network?.segments.at(-1)?.end).toBe(0)
    expect(network?.segments).toHaveLength(network?.vertices.length ?? -1)
    expect(network?.regions).toEqual([])
  })

  test('goes into the given parent at its local position', () => {
    const editor = pencilEditor()
    const frame = editor.createShape('FRAME', -50, -100, 400, 200)
    const id = draw(editor, sine(), { parentId: frame })
    const node = id ? getNodeOrThrow(editor.graph, id) : undefined
    expect(node?.parentId).toBe(frame)
    expect(node?.x).toBe(50)
  })

  test('contrasts with what it is drawn on', () => {
    const editor = pencilEditor()
    editor.state.pageColor = DARK_PAGE
    const onPage = draw(editor, sine())
    expect(onPage && getNodeOrThrow(editor.graph, onPage).strokes[0]?.color).toMatchObject({
      r: 1,
      g: 1,
      b: 1
    })

    const frame = editor.createShape('FRAME', -50, -100, 400, 200)
    const inFrame = draw(editor, sine(), { parentId: frame })
    expect(inFrame && getNodeOrThrow(editor.graph, inFrame).strokes[0]?.color).toMatchObject({
      r: 0,
      g: 0,
      b: 0
    })
  })

  test('takes the style of the last pencil layer once it is restyled', () => {
    const editor = pencilEditor()
    const first = draw(editor, sine())
    if (!first) throw new Error('nothing drawn')
    const red = { r: 1, g: 0, b: 0, a: 1 }
    editor.graph.updateNode(first, {
      strokes: [
        { type: 'SOLID', color: red, opacity: 1, visible: true, weight: 6, align: 'CENTER' }
      ]
    })
    editor.graph.deleteNode(first)

    const second = draw(editor, sine(0, 100))
    expect(second && getNodeOrThrow(editor.graph, second).strokes[0]).toMatchObject({
      color: red,
      weight: 6
    })
    expect(editor.state.pencilState).toBeNull()
  })

  test('shows the stroke being drawn in the colour it will have', () => {
    const editor = pencilEditor()
    editor.state.pageColor = DARK_PAGE
    editor.pencilBegin(0, 0)
    expect(editor.state.pencilState?.preview).toEqual({
      color: { r: 1, g: 1, b: 1, a: 1 },
      weight: 2
    })
    editor.pencilCancel()
    expect(editor.state.pencilState).toBeNull()
  })

  test('undoes a stroke in one step', () => {
    const editor = pencilEditor()
    const id = draw(editor, sine())
    if (!id) throw new Error('nothing drawn')
    editor.undo.undo()
    expect(editor.graph.getNode(id)).toBeUndefined()
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, id).vectorNetwork?.segments.length).toBeGreaterThan(1)
  })
})
