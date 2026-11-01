import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import { colorToHex } from '@open-pencil/scene-graph/color'
import { createSticky } from '@open-pencil/scene-graph/generated'

function setup() {
  const editor = createEditor({ loadFont: () => Promise.resolve(null) })
  return { editor, pageId: editor.state.currentPageId }
}

const hex = (paint: { color: { r: number; g: number; b: number } } | undefined) =>
  paint ? colorToHex({ ...paint.color, a: 1 }).toLowerCase() : undefined

describe("FigJam's colour menu", () => {
  test('tints a section, paints a rectangle and text, and is one undo step', () => {
    const { editor, pageId } = setup()
    const section = editor.createShape('SECTION', 0, 0, 400, 300, pageId)
    const rect = editor.createShape('RECTANGLE', 500, 0, 100, 100, pageId)
    const text = editor.createShape('TEXT', 700, 0, 100, 20, pageId)
    editor.setFigJamColor([section, rect, text], 'red')
    const get = (id: string) => expectDefined(editor.graph.getNode(id))
    expect([hex(get(section).fills[0]), hex(get(section).strokes[0])]).toEqual(['#ffe2e0', '#f24822'])
    expect([hex(get(rect).fills[0]), hex(get(rect).strokes[0])]).toEqual(['#f24822', '#f24822'])
    expect(hex(get(text).fills[0])).toBe('#f24822')
    editor.undo.undo()
    expect(hex(get(rect).fills[0])).not.toBe('#f24822')
    expect(hex(get(section).fills[0])).not.toBe('#ffe2e0')
    expect(hex(get(text).fills[0])).not.toBe('#f24822')
  })

  test("colours a group's layers and leaves sticky notes and images to their own", () => {
    const { editor, pageId } = setup()
    const a = editor.createShape('RECTANGLE', 0, 0, 100, 100, pageId)
    const b = editor.createShape('ELLIPSE', 200, 0, 100, 100, pageId)
    const photo = editor.createShape('RECTANGLE', 400, 0, 100, 100, pageId)
    const image = {
      type: 'IMAGE' as const,
      color: { r: 0, g: 0, b: 0, a: 1 },
      imageHash: 'hash',
      imageScaleMode: 'FILL' as const,
      opacity: 1,
      visible: true
    }
    editor.graph.updateNode(photo, { fills: [image] })
    editor.select([a, b, photo])
    const group = expectDefined(editor.groupSelected())
    const sticky = createSticky(editor.graph, pageId, {})
    const before = hex(sticky.fills[0])
    editor.setFigJamColor([group, sticky.id], 'blue')
    expect(hex(editor.graph.getNode(b)?.fills[0])).toBe('#3dadff')
    expect(editor.graph.getNode(photo)?.fills).toEqual([image])
    expect(hex(editor.graph.getNode(sticky.id)?.fills[0])).toBe(before)
  })

  test("dashes a section's outline, giving it one first if it has none", () => {
    const { editor, pageId } = setup()
    const section = editor.createShape('SECTION', 0, 0, 400, 300, pageId)
    editor.graph.updateNode(section, { strokes: [] })
    editor.setSectionLineStyle([section], 'dashed')
    const node = expectDefined(editor.graph.getNode(section))
    expect(node.dashPattern).toEqual([16, 10])
    expect(node.strokes).toHaveLength(1)
  })
})
