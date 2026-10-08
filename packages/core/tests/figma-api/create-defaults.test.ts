import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Recorded with the same script in Figma desktop 126: new layers from the plugin API and from the
// drawing tools start alike.

const WHITE = [1, 1, 1]
const GREY = [0.85, 0.85, 0.85]
const BLACK = [0, 0, 0]

function solid(paints: readonly { type: string; color?: { r: number; g: number; b: number } }[]) {
  return paints.map((paint) =>
    paint.color
      ? [paint.color.r, paint.color.g, paint.color.b].map((v) => Math.round(v * 100) / 100)
      : paint.type
  )
}

function api() {
  return new FigmaAPI(new SceneGraph())
}

describe('new layer defaults', () => {
  test('frames and components are white, and frames clip their content', () => {
    const figma = api()
    const frame = figma.createFrame()
    const component = figma.createComponent()
    expect(solid(frame.fills)).toEqual([WHITE])
    expect(frame.clipsContent).toBe(true)
    expect(solid(component.fills)).toEqual([WHITE])
    expect(component.clipsContent).toBe(false)
  })

  test('shapes are light grey', () => {
    const figma = api()
    for (const shape of [
      figma.createRectangle(),
      figma.createEllipse(),
      figma.createPolygon(),
      figma.createStar()
    ]) {
      expect(solid(shape.fills)).toEqual([GREY])
      expect(shape.strokes).toEqual([])
    }
  })

  test('lines and vectors have a black 1 px stroke, and a line has no height', () => {
    const figma = api()
    const line = figma.createLine()
    const vector = figma.createVector()
    expect([line.width, line.height]).toEqual([100, 0])
    for (const node of [line, vector]) {
      expect(node.fills).toEqual([])
      expect(solid(node.strokes)).toEqual([BLACK])
      expect(node.strokeWeight).toBe(1)
    }
  })

  test('a stroke a script adds takes the 1 px default weight', () => {
    const rect = api().createRectangle()
    expect(rect.strokeWeight).toBe(1)
    // Scripts pass Figma paints, which carry no weight.
    Reflect.set(rect, 'strokes', [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }])
    expect(rect.strokeWeight).toBe(1)
  })

  test('sections are 496 square with a faint white outline, filled for the interface theme', () => {
    const figma = api()
    const light = figma.createSection()
    expect([light.width, light.height, light.cornerRadius]).toEqual([496, 496, 2])
    expect(solid(light.fills)).toEqual([WHITE])
    expect(solid(light.strokes)).toEqual([WHITE])
    expect([light.strokes[0]?.opacity, light.strokeAlign]).toEqual([0.1, 'INSIDE'])
    // Figma fills a section #444444 in its dark theme.
    figma.theme = 'dark'
    expect(solid(figma.createSection().fills)).toEqual([[0.27, 0.27, 0.27]])
  })

  test('each layer gets its own copy of the default paints', () => {
    const editor = createEditor()
    try {
      const page = editor.state.currentPageId
      const first = editor.graph.getNode(editor.createShape('RECTANGLE', 0, 0, 10, 10, page))
      const color = first?.fills[0]?.color
      if (color) color.r = 1
      const second = editor.graph.getNode(editor.createShape('RECTANGLE', 0, 0, 10, 10, page))
      expect(solid(second?.fills ?? [])).toEqual([GREY])
    } finally {
      editor.dispose()
    }
  })

  test('the drawing tools use the same defaults', () => {
    const editor = createEditor()
    try {
      const page = editor.state.currentPageId
      const frame = editor.graph.getNode(editor.createShape('FRAME', 0, 0, 100, 100, page))
      const line = editor.graph.getNode(editor.createShape('LINE', 0, 0, 100, 0, page))
      expect(frame?.clipsContent).toBe(true)
      expect(solid(frame?.fills ?? [])).toEqual([WHITE])
      expect(line?.fills).toEqual([])
      expect(solid(line?.strokes ?? [])).toEqual([BLACK])
      expect(line?.strokes[0]?.weight).toBe(1)
    } finally {
      editor.dispose()
    }
  })
})
