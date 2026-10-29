import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import { setTextMeasurer } from '@open-pencil/core/layout'
import { colorToHex } from '@open-pencil/scene-graph/color'
import { shapeWithTextLabel } from '@open-pencil/scene-graph/generated'
import { lineHeightPixels } from '@open-pencil/scene-graph/text'

import { applyGeneratedTextNameEdit } from '#core/editor/text/name'

function setup() {
  const editor = createEditor({ loadFont: () => Promise.resolve(null) })
  return { editor, pageId: editor.state.currentPageId }
}

beforeEach(() => {
  setTextMeasurer((node, maxWidth) => ({
    width: maxWidth ?? node.width,
    height:
      node.text.split('\n').length *
      (lineHeightPixels(node.lineHeight, node.fontSize) ?? node.fontSize)
  }))
})
afterEach(() => setTextMeasurer(null))

describe('shapes with text in the editor', () => {
  test('the tool places the kind picked last, painted as FigJam paints a new shape', () => {
    const { editor, pageId } = setup()
    editor.setShapeWithTextKind('DIAMOND')
    const id = editor.createShape('SHAPE_WITH_TEXT', 0, 0, 176, 176, pageId)
    const shape = expectDefined(editor.graph.getNode(id))
    expect(shape.shapeWithTextType).toBe('DIAMOND')
    expect(shape.fills[0]?.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    expect(shape.strokes[0]).toMatchObject({ weight: 4, align: 'CENTER' })
    expect(expectDefined(shapeWithTextLabel(editor.graph, shape)).fontSize).toBe(16)
  })

  test('switching the kind keeps the size, and is one undo step', () => {
    const { editor, pageId } = setup()
    const id = editor.createShape('SHAPE_WITH_TEXT', 0, 0, 240, 120, pageId)
    editor.changeShapesWithTextKind([id], 'HEXAGON')
    expect(editor.graph.getNode(id)).toMatchObject({
      shapeWithTextType: 'HEXAGON',
      width: 240,
      height: 120
    })
    editor.undo.undo()
    expect(editor.graph.getNode(id)?.shapeWithTextType).toBe('SQUARE')
  })

  test("typing in a shape's label renames a shape that was never renamed", () => {
    const { editor, pageId } = setup()
    const id = editor.createShape('SHAPE_WITH_TEXT', 0, 0, 176, 176, pageId)
    const shape = expectDefined(editor.graph.getNode(id))
    const label = expectDefined(shapeWithTextLabel(editor.graph, shape))
    applyGeneratedTextNameEdit(editor, label.id, 'Valid?')
    expect(editor.graph.getNode(id)?.name).toBe('Valid?')
    applyGeneratedTextNameEdit(editor, label.id, '')
    expect(editor.graph.getNode(id)?.name).toBe('Shape with text')
  })

  test("FigJam's colour menu paints the shape, its outline and its label, in one step", () => {
    const { editor, pageId } = setup()
    const id = editor.createShape('SHAPE_WITH_TEXT', 0, 0, 176, 176, pageId)
    editor.setShapesWithTextColor([id], 'violet')
    const shape = expectDefined(editor.graph.getNode(id))
    const hex = (color = shape.fills[0]?.color) => color && colorToHex(color).toLowerCase()
    expect([hex(), hex(shape.strokes[0]?.color)]).toEqual(['#874fff', '#5427b4'])
    expect(expectDefined(shapeWithTextLabel(editor.graph, shape)).fills[0]?.color).toMatchObject({
      r: 1,
      g: 1,
      b: 1
    })
    editor.setShapesWithTextFillMode([id], 'transparent')
    expect(editor.graph.getNode(id)?.fills[0]?.opacity).toBe(0.5)
    editor.setShapesWithTextFillMode([id], 'none')
    editor.setShapesWithTextColor([id], 'violet')
    // A colour picked for a shape without fill fills it again.
    expect(editor.graph.getNode(id)?.fills[0]?.opacity).toBe(1)
    editor.undo.undo()
    editor.undo.undo()
    editor.undo.undo()
    editor.undo.undo()
    expect(hex(editor.graph.getNode(id)?.fills[0]?.color)).toBe('#ffffff')
  })

  test('the line menu dashes the outline, and a larger text size grows the shape', () => {
    const { editor, pageId } = setup()
    const id = editor.createShape('SHAPE_WITH_TEXT', 0, 0, 176, 176, pageId)
    editor.setShapesWithTextLineStyle([id], 'dashed')
    expect(editor.graph.getNode(id)?.dashPattern).toEqual([16, 10])
    const shape = expectDefined(editor.graph.getNode(id))
    const label = expectDefined(shapeWithTextLabel(editor.graph, shape))
    editor.graph.updateNode(label.id, { text: 'one\ntwo\nthree' })
    editor.setShapesWithTextTextSize([id], 'huge')
    expect(editor.graph.getNode(label.id)?.fontSize).toBe(96)
    expect(editor.graph.getNode(id)?.height).toBeGreaterThan(176)
    editor.setShapesWithTextTextSize([id], 'small')
    expect(editor.graph.getNode(id)?.height).toBe(176)
  })
})
