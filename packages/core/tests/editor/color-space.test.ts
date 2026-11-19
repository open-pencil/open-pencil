import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { toExtendedSRGB } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

let editor: Editor

afterEach(() => editor.dispose())

/** Display P3 red, outside sRGB. */
const P3_RED: Color = { r: 1, g: 0, b: 0, a: 1 }
/** A Display P3 blue inside sRGB too. */
const BLUE: Color = { r: 0.3, g: 0.5, b: 0.7, a: 1 }

/** A Display P3 document with a translucent red layer, a page color, and a color variable. */
function p3Document() {
  editor = createEditor()
  editor.graph.documentColorSpace = 'display-p3'
  const pageId = editor.state.currentPageId
  const layer = editor.graph.createNode('RECTANGLE', pageId, {
    fills: [{ type: 'SOLID', color: P3_RED, opacity: 0.5, visible: true }],
    strokes: [{ color: BLUE, weight: 1, type: 'SOLID', opacity: 1, visible: true, align: 'INSIDE' }]
  })
  editor.setPageColor(BLUE)
  const collection = editor.graph.createCollection('Theme')
  const variable = editor.graph.createVariable('Accent', 'COLOR', collection.id, P3_RED)
  const mode = collection.modes[0].modeId
  const fill = () => editor.graph.getNode(layer.id)?.fills[0]
  const stroke = () => editor.graph.getNode(layer.id)?.strokes[0].color
  const accent = () => editor.graph.variables.get(variable.id)?.valuesByMode[mode]
  return { fill, stroke, accent, page: () => editor.state.pageColor }
}

function expectColor(actual: unknown, expected: Color, precision = 4) {
  const color = actual as Color
  for (const channel of ['r', 'g', 'b', 'a'] as const) {
    expect(color[channel]).toBeCloseTo(expected[channel], precision)
  }
}

describe('document color profile', () => {
  test('assigning keeps every value and is one undo step', () => {
    const { fill, accent } = p3Document()
    editor.setDocumentColorSpace('srgb', 'assign')
    expect(editor.graph.documentColorSpace).toBe('srgb')
    expect(fill()?.color).toEqual(P3_RED)
    expect(accent()).toEqual(P3_RED)
    editor.undo.undo()
    expect(editor.graph.documentColorSpace).toBe('display-p3')
    editor.undo.redo()
    expect(editor.graph.documentColorSpace).toBe('srgb')
  })

  test('converting rewrites layers, pages, and variables from the current profile', () => {
    const { fill, stroke, accent, page } = p3Document()
    editor.setDocumentColorSpace('srgb', 'convert')

    // P3 red maps into sRGB as its nearest red, not read as if it were sRGB already.
    const red = fill()?.color
    expect(red?.r).toBeGreaterThan(0.95)
    expect(red?.g).toBeLessThan(0.2)
    expectColor(accent(), red ?? P3_RED)
    // The paint's own opacity is kept, not replaced with the color's alpha.
    expect(fill()?.opacity).toBe(0.5)
    // A color sRGB can show keeps its look: its new values are the same color in sRGB.
    const blue = toExtendedSRGB(BLUE, 'display-p3')
    expectColor(stroke(), blue)
    expectColor(page(), blue)
  })

  test('undoing a conversion puts back every value and the profile in one step', () => {
    const { fill, stroke, accent, page } = p3Document()
    const before = { stroke: stroke(), page: page() }
    editor.setDocumentColorSpace('srgb', 'convert')
    editor.undo.undo()
    expect(editor.graph.documentColorSpace).toBe('display-p3')
    expect(fill()?.color).toEqual(P3_RED)
    expect(accent()).toEqual(P3_RED)
    expect(stroke()).toEqual(before.stroke)
    expectColor(page(), before.page)
  })
})
