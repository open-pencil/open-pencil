import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Recorded with the same script in Figma desktop 126: stroke weight and alignment belong to the
// node, so they last without strokes and a stroke added later takes them.

const red = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]

function api() {
  return new FigmaAPI(new SceneGraph())
}

describe('plugin API stroke geometry', () => {
  test('new nodes align strokes inside, centered on lines and vectors, outside text', () => {
    const figma = api()
    expect(figma.createRectangle().strokeAlign).toBe('INSIDE')
    expect(figma.createFrame().strokeAlign).toBe('INSIDE')
    expect(figma.createLine().strokeAlign).toBe('CENTER')
    expect(figma.createVector().strokeAlign).toBe('CENTER')
    expect(figma.createText().strokeAlign).toBe('OUTSIDE')
  })

  test('weight and alignment set before a stroke are kept and given to it', () => {
    const figma = api()
    const rect = figma.createRectangle()
    rect.strokeWeight = 5
    expect(rect.strokeWeight).toBe(5)
    // Scripts pass Figma paints, which carry no geometry.
    Reflect.set(rect, 'strokes', red)
    expect([rect.strokeWeight, rect.strokeAlign]).toEqual([5, 'INSIDE'])

    const ellipse = figma.createEllipse()
    ellipse.strokeAlign = 'OUTSIDE'
    Reflect.set(ellipse, 'strokes', red)
    expect([ellipse.strokeAlign, ellipse.strokeWeight]).toEqual(['OUTSIDE', 1])
  })

  test('the weight applies to every stroke and outlasts them', () => {
    const rect = api().createRectangle()
    Reflect.set(rect, 'strokes', [...red, ...red])
    rect.strokeWeight = 4
    expect(rect.strokes.map((stroke) => stroke.weight)).toEqual([4, 4])
    rect.strokes = []
    expect(rect.strokeWeight).toBe(4)
    Reflect.set(rect, 'strokes', red)
    expect(rect.strokeWeight).toBe(4)
  })

  test('a node keeps its own copy of the strokes a script sets', () => {
    const rect = api().createRectangle()
    const paint = { type: 'SOLID', color: { r: 1, g: 0, b: 0 }, dashPattern: [4, 2] }
    Reflect.set(rect, 'strokes', [paint])
    paint.color.g = 1
    paint.dashPattern.push(9)
    expect(rect.strokes[0]?.color).toMatchObject({ r: 1, g: 0, b: 0 })
    expect(rect.strokes[0]?.dashPattern).toEqual([4, 2])
  })

  test('rescale scales the weight a node keeps without strokes', () => {
    const rect = api().createRectangle()
    rect.strokeWeight = 3
    rect.strokeAlign = 'CENTER'
    rect.rescale(2)
    expect([rect.strokeWeight, rect.strokeAlign]).toEqual([6, 'CENTER'])
  })
})
