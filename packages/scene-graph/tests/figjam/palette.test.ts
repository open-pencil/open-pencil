import { describe, expect, test } from 'bun:test'

import { createShapeWithText, shapeWithTextLabel } from '@open-pencil/scene-graph/generated'
import { figJamColor, figJamColorName, figJamLayerColorFields, figJamLayerColorName, figJamLineColorFields, figJamLineStyle, figJamLineStyleFields, figJamOutlineColorName, figJamSectionColorFields, figJamSectionColorName, figJamShapePaint } from '@open-pencil/scene-graph/figjam'
import { SceneGraph } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

/** A shape as FigJam's tool places it: white, with its #757575 outline and a dark label. */
function placedShape() {
  const graph = new SceneGraph()
  const shape = createShapeWithText(graph, graph.getPages()[0].id, {
    fills: [{ type: 'SOLID', color: figJamColor('white'), opacity: 1, visible: true }],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0x75 / 255, g: 0x75 / 255, b: 0x75 / 255, a: 1 },
        opacity: 1,
        visible: true,
        weight: 4,
        align: 'CENTER'
      }
    ]
  })
  const label = shapeWithTextLabel(graph, shape)
  if (!label) throw new Error('shape has no label')
  return { graph, shape, label }
}

function hexes(paints: { color: { r: number; g: number; b: number } }[] | undefined) {
  return paints?.map((paint) => colorToHex({ ...paint.color, a: 1 }).toLowerCase())
}

// Values measured in FigJam's colour and line menus.
describe("FigJam's shape colours", () => {
  test('a fill brings its paired outline and, on the darkest colours, a light label', () => {
    const { shape, label } = placedShape()
    const red = figJamShapePaint(shape, label, 'red', 'fill')
    expect(hexes(red.shape.fills)).toEqual(['#f24822'])
    expect(hexes(red.shape.strokes)).toEqual(['#bd2915'])
    expect(red.label.fills?.[0]).toMatchObject({ color: { r: 1, g: 1, b: 1 }, opacity: 1 })

    const yellow = figJamShapePaint(shape, label, 'lightYellow', 'fill')
    expect(hexes(yellow.shape.strokes)).toEqual(['#ffc943'])
    expect(yellow.label.fills?.[0]).toMatchObject({ color: { r: 0, g: 0, b: 0 }, opacity: 0.8 })
  })

  test('transparent and no fill keep the colour at their opacity, with their own outline', () => {
    const { shape, label } = placedShape()
    const blue = figJamShapePaint(shape, label, 'blue', 'transparent')
    expect(blue.shape.fills?.[0]?.opacity).toBe(0.7)
    expect(hexes(blue.shape.strokes)).toEqual(['#4d99d3'])
    const none = figJamShapePaint(shape, label, 'yellow', 'none')
    expect(none.shape.fills?.[0]).toMatchObject({ opacity: 0 })
    expect(hexes(none.shape.strokes)).toEqual(['#f5d280'])
  })

  test('an outline coloured by hand stays when the fill changes', () => {
    const { shape, label } = placedShape()
    const blueLine = { ...shape, ...figJamLineColorFields(shape, 'blue') }
    const repainted = figJamShapePaint(blueLine, label, 'red', 'fill')
    expect(repainted.shape.strokes).toBeUndefined()
  })

  test('a palette colour is found back from a paint', () => {
    expect(figJamColorName(figJamColor('lightViolet'))).toBe('lightViolet')
    expect(figJamColorName({ r: 0.1, g: 0.2, b: 0.3, a: 1 })).toBeNull()
  })

  test('the line menu dashes or hides the outline, keeping its weight', () => {
    const { shape } = placedShape()
    const dashed = figJamLineStyleFields(shape, 'dashed')
    expect(dashed.dashPattern).toEqual([16, 10])
    // Strokes are drawn with their own dash, and files keep the layer's.
    expect(dashed.strokes?.[0]?.dashPattern).toEqual([16, 10])
    expect(figJamLineStyle({ ...shape, ...dashed })).toBe('dashed')
    const hidden = figJamLineStyleFields(shape, 'none')
    expect(hidden.strokes?.[0]).toMatchObject({ opacity: 0, weight: 4 })
    expect(figJamLineStyle({ ...shape, ...hidden })).toBe('none')
    // Colouring a hidden outline shows it again.
    const shown = figJamLineColorFields({ ...shape, ...hidden }, 'red')
    expect(shown.strokes?.[0]?.opacity).toBe(1)
  })

  // Measured in FigJam: a section takes a pale tint outlined in the colour itself, 2 px.
  test('the colour menu tints a section and outlines it in the colour', () => {
    const red = figJamSectionColorFields({ strokes: [] }, 'red')
    expect(hexes(red.fills)).toEqual(['#ffe2e0'])
    expect(hexes(red.strokes)).toEqual(['#f24822'])
    expect(red.strokeWeight).toBe(2)
    expect(hexes(figJamSectionColorFields({ strokes: [] }, 'black').strokes)).toEqual(['#2c2c2c'])
    expect(hexes(figJamSectionColorFields({ strokes: [] }, 'lightBlue').fills)).toEqual(['#f5fbff'])
    expect(figJamSectionColorName({ fills: red.fills ?? [] })).toBe('red')
    const hidden = { type: 'SOLID' as const, color: figJamColor('blue'), opacity: 1, visible: false }
    expect(figJamSectionColorName({ fills: [hidden, ...(red.fills ?? [])] })).toBe('red')
  })

  test("a section's outline reads as its colour, darker for black and lighter for white", () => {
    for (const name of ['black', 'white', 'red'] as const) {
      const outline = figJamSectionColorFields({ strokes: [] }, name).strokes?.[0]?.color
      expect(figJamOutlineColorName(outline)).toBe(name)
    }
  })

  test('the colour menu paints text, a line, and other layers as FigJam does', () => {
    const text = figJamLayerColorFields({ type: 'TEXT', fills: [], strokes: [], styleRuns: [] }, 'red')
    expect(hexes(text.fills)).toEqual(['#f24822'])
    expect(text.strokes).toBeUndefined()
    const line = figJamLayerColorFields({ type: 'LINE', fills: [], strokes: [], styleRuns: [] }, 'blue')
    expect(line.fills).toBeUndefined()
    expect(hexes(line.strokes)).toEqual(['#3dadff'])
    const rect = figJamLayerColorFields({ type: 'RECTANGLE', fills: [], strokes: [], styleRuns: [] }, 'red')
    expect(hexes(rect.fills)).toEqual(['#f24822'])
    expect(rect.strokes?.[0]).toMatchObject({ weight: 1 })
    expect(figJamLayerColorName({ type: 'RECTANGLE', fills: rect.fills ?? [], strokes: [] })).toBe('red')
  })

  test('a pen stroke takes the colour as its stroke, a filled vector as its fill and stroke', () => {
    const pen = figJamLayerColorFields({ type: 'VECTOR', fills: [], strokes: [], styleRuns: [] }, 'blue')
    expect(pen.fills).toBeUndefined()
    const filled = { type: 'SOLID' as const, color: figJamColor('black'), opacity: 1, visible: true }
    const shape = figJamLayerColorFields({ type: 'VECTOR', fills: [filled], strokes: [], styleRuns: [] }, 'blue')
    expect(hexes(shape.fills)).toEqual(['#3dadff'])
    expect(hexes(shape.strokes)).toEqual(['#3dadff'])
    const clear = figJamLayerColorFields({ type: 'VECTOR', fills: [{ ...filled, opacity: 0 }], strokes: [], styleRuns: [] }, 'blue')
    expect(clear.fills).toBeUndefined()
  })

  test('a layer shows the colour of its first paint the canvas draws', () => {
    const paint = (name: 'red' | 'green' | 'blue', visible: boolean, opacity = 1) => ({ type: 'SOLID' as const, color: figJamColor(name), opacity, visible })
    const fills = [paint('red', true), paint('blue', true), paint('green', true, 0), paint('red', false)]
    expect(figJamLayerColorName({ type: 'RECTANGLE', fills, strokes: [] })).toBe('blue')
  })

  test('the colour reaches gradient strokes and ranges of text coloured on their own', () => {
    const gradient = { type: 'GRADIENT_LINEAR' as const, color: figJamColor('black'), opacity: 1, visible: true, weight: 2, align: 'INSIDE' as const }
    const rect = figJamLayerColorFields({ type: 'RECTANGLE', fills: [], strokes: [gradient], styleRuns: [] }, 'red')
    expect(rect.strokes?.[0]?.type).toBe('SOLID')
    const run = { start: 0, length: 2, style: { fills: [{ type: 'SOLID' as const, color: figJamColor('blue'), opacity: 1, visible: true }], fontSize: 30 } }
    const text = figJamLayerColorFields({ type: 'TEXT', fills: [], strokes: [], styleRuns: [run] }, 'red')
    expect(text.styleRuns?.[0]?.style).toEqual({ fontSize: 30 })
  })
})
