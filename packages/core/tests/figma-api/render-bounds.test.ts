import { describe, expect, test } from 'bun:test'

import { solidFill } from '#core-tests/helpers/figma-api'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('absoluteRenderBounds', () => {
  test('absoluteRenderBounds includes strokes and effects and returns null for invisible pixels', () => {
    const api = new FigmaAPI(new SceneGraph())
    const rect = api.createRectangle()
    rect.x = 3
    rect.y = 4
    rect.resize(10, 20)
    rect.strokes = [solidFill({ r: 1, g: 0, b: 0, a: 1 })]
    rect.strokeWeight = 4
    rect.strokeAlign = 'OUTSIDE'
    rect.effects = [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 5, y: -3 },
        radius: 2,
        spread: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]

    expect(rect.absoluteBoundingBox).toEqual({ x: 3, y: 4, width: 10, height: 20 })
    expect(rect.absoluteRenderBounds).toEqual({ x: -1, y: -6, width: 26, height: 34 })

    rect.visible = false
    expect(rect.absoluteBoundingBox).toEqual({ x: 3, y: 4, width: 10, height: 20 })
    expect(rect.absoluteRenderBounds).toBeNull()

    const emptyVector = api.createVector()
    expect(emptyVector.absoluteRenderBounds).toBeNull()
  })

  // Figma 126 draws a fixed-size text's lines past its box, and their shadow with them.
  test('absoluteRenderBounds reaches text lines past a fixed-size box and their shadow', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const text = api.createText()
    text.characters = 'Lines'
    text.fills = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]
    text.textAutoResize = 'NONE'
    text.resize(110, 40)
    graph.updateNode(text.id, { derivedTextHeight: 150 })
    text.effects = [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 10 },
        radius: 0,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]

    expect(text.absoluteRenderBounds).toEqual({ x: 0, y: 0, width: 110, height: 160 })
  })

  test('absoluteRenderBounds is clipped by ancestor frames', () => {
    const api = new FigmaAPI(new SceneGraph())
    const frame = api.createFrame()
    frame.resize(100, 100)
    frame.clipsContent = true
    const rect = api.createRectangle()
    rect.x = 150
    rect.resize(20, 20)
    frame.appendChild(rect)

    expect(rect.absoluteRenderBounds).toBeNull()
  })
})
