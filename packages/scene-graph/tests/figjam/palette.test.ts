import { describe, expect, test } from 'bun:test'

import { createShapeWithText, shapeWithTextLabel } from '@open-pencil/scene-graph/generated'
import { figJamColor, figJamColorName, figJamLineColorFields, figJamLineStyle, figJamLineStyleFields, figJamShapePaint } from '@open-pencil/scene-graph/figjam'
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
})
