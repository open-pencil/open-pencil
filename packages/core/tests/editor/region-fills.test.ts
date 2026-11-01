import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import type { Fill } from '@open-pencil/scene-graph'

const solid = (r: number, g: number, b: number): Fill => ({
  type: 'SOLID',
  color: { r, g, b, a: 1 },
  opacity: 1,
  visible: true
})

// Setting a vector's fills makes every region draw them in Figma (live-verified).
describe("setting a vector's fills", () => {
  test('makes every region draw them, and undo brings the regions back', () => {
    const editor = createEditor()
    const zero = { x: 0, y: 0 }
    const line = (start: number, end: number) => ({ start, end, tangentStart: zero, tangentEnd: zero })
    const vector = editor.graph.createNode('VECTOR', editor.graph.getPages()[0].id, {
      width: 10,
      height: 10,
      fills: [solid(0.5, 0.5, 0.5)],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 }
        ],
        segments: [line(0, 1), line(1, 2), line(2, 0)],
        regions: [
          { windingRule: 'NONZERO', loops: [[0, 1, 2]], fills: [solid(1, 0, 0)], fillStyleId: 'style:red' }
        ]
      }
    })
    const regions = () => getNodeOrThrow(editor.graph, vector.id).vectorNetwork?.regions

    editor.updateNodeWithUndo(vector.id, { fills: [solid(0, 1, 0)] })
    expect(getNodeOrThrow(editor.graph, vector.id).fills).toEqual([solid(0, 1, 0)])
    expect(regions()).toEqual([{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }])

    editor.undo.undo()
    expect(regions()?.[0]).toMatchObject({ fills: [solid(1, 0, 0)], fillStyleId: 'style:red' })
  })

  test('drops the style of a region linked to one without its paints', () => {
    const editor = createEditor()
    const vector = editor.graph.createNode('VECTOR', editor.graph.getPages()[0].id, {
      vectorNetwork: {
        vertices: [],
        segments: [],
        regions: [{ windingRule: 'NONZERO', loops: [], fillStyleId: 'style:red' }]
      }
    })
    editor.updateNodeWithUndo(vector.id, { fills: [solid(0, 1, 0)] })
    expect(getNodeOrThrow(editor.graph, vector.id).vectorNetwork?.regions).toEqual([
      { windingRule: 'NONZERO', loops: [] }
    ])
  })
})
