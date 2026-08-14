import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

function setup() {
  const graph = new SceneGraph()
  return { graph, api: new FigmaAPI(graph) }
}

describe('Figma Plugin API layout compatibility', () => {
  test('rescale scales geometry, visual properties, and descendants from the root top-left', () => {
    const { api, graph } = setup()
    const frame = api.createFrame()
    frame.x = 30
    frame.y = 40
    frame.resize(100, 80)
    frame.paddingLeft = 10
    frame.paddingRight = 12
    frame.paddingTop = 6
    frame.paddingBottom = 8
    frame.itemSpacing = 5
    frame.cornerRadius = 7
    frame.strokes = [
      {
        color: { r: 0, g: 0, b: 0, a: 1 },
        weight: 3,
        opacity: 1,
        visible: true,
        align: 'CENTER'
      }
    ]
    frame.effects = [
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

    const text = api.createText()
    text.characters = 'Hi'
    text.fontSize = 10
    text.letterSpacing = 2
    text.lineHeight = 14
    frame.appendChild(text)
    text.x = 11
    text.y = 13

    frame.rescale(2)

    expect(frame.x).toBe(30)
    expect(frame.y).toBe(40)
    expect(frame.width).toBe(200)
    expect(frame.height).toBe(160)
    expect(frame.paddingLeft).toBe(20)
    expect(frame.paddingRight).toBe(24)
    expect(frame.paddingTop).toBe(12)
    expect(frame.paddingBottom).toBe(16)
    expect(frame.itemSpacing).toBe(10)
    expect(frame.cornerRadius).toBe(14)
    expect(frame.strokeWeight).toBe(6)
    expect(frame.effects[0]?.offset).toEqual({ x: 10, y: -6 })
    expect(frame.effects[0]?.radius).toBe(4)
    expect(frame.effects[0]?.spread).toBe(2)
    expect(text.x).toBe(22)
    expect(text.y).toBe(26)
    expect(text.fontSize).toBe(20)
    expect(text.letterSpacing).toBe(4)
    expect(text.lineHeight).toBe(28)
    expect(graph.getNode(text.id)?.width).toBe(200)
  })

  test('rescale rejects non-Figma scale factors and pages', () => {
    const { api } = setup()
    const rect = api.createRectangle()
    expect(() => rect.rescale(0.009)).toThrow('Scale must be at least 0.01')
    expect(() => rect.rescale(Number.POSITIVE_INFINITY)).toThrow('Scale must be a finite number')
    expect(() => api.currentPage.rescale(2)).toThrow('rescale() is not supported on this node')
    const section = api.createSection()
    expect(() => section.rescale(2)).toThrow('rescale() is not supported on this node')
  })

  test('page backgrounds expose imported canvas paints and support assignment', () => {
    const { api, graph } = setup()
    const page = graph.getNode(api.currentPage.id)
    expect(page).toBeDefined()
    if (!page) return
    page.source.fig.rawNodeFields.backgroundPaints = [
      {
        type: 'SOLID',
        color: { r: 0.5, g: 0.75, b: 1, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]

    expect(api.currentPage.backgrounds).toEqual([
      {
        type: 'SOLID',
        color: { r: 0.5, g: 0.75, b: 1, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ])

    api.currentPage.backgrounds = [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 0.5,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
    expect(api.currentPage.backgrounds[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(page.source.fig.rawNodeFields.backgroundColor).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  })

  test('absoluteRenderBounds includes strokes and effects and returns null for invisible pixels', () => {
    const { api } = setup()
    const rect = api.createRectangle()
    rect.x = 3
    rect.y = 4
    rect.resize(10, 20)
    rect.strokes = [
      {
        color: { r: 1, g: 0, b: 0, a: 1 },
        weight: 4,
        opacity: 1,
        visible: true,
        align: 'OUTSIDE'
      }
    ]
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

  test('absoluteRenderBounds is clipped by ancestor frames', () => {
    const { api } = setup()
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
