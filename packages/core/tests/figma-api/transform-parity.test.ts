import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

// Recorded with the same script in Figma desktop 126: the plugin API turns a node
// counterclockwise about its top-left corner, and x and y are that corner in the parent.

const round = (value: number) => Math.round(value * 1000) / 1000
const rounded = (rows: readonly (readonly number[])[]) => rows.map((row) => row.map(round))
const box = (rect: Rect) =>
  [rect.x, rect.y, rect.width, rect.height].map(round)

function rectangle() {
  const figma = new FigmaAPI(new SceneGraph())
  const rect = figma.createRectangle()
  rect.x = 100
  rect.y = 100
  rect.resize(100, 50)
  return { figma, rect }
}

describe('plugin API rotation', () => {
  test('turns counterclockwise about the top-left corner', () => {
    const { rect } = rectangle()
    rect.rotation = 30
    expect([rect.x, rect.y, rect.rotation]).toEqual([100, 100, 30])
    expect(rounded(rect.relativeTransform)).toEqual([
      [0.866, 0.5, 100],
      [-0.5, 0.866, 100]
    ])
    expect(box(rect.absoluteBoundingBox)).toEqual([100, 50, 111.603, 93.301])

    rect.rotation = -45
    expect(rounded(rect.relativeTransform)).toEqual([
      [0.707, -0.707, 100],
      [0.707, 0.707, 100]
    ])
    rect.rotation = 200
    expect(round(rect.rotation)).toBe(-160)
  })

  test('a turned node moves and resizes about the same corner', () => {
    const { rect } = rectangle()
    rect.rotation = 30
    rect.x = 0
    expect([rect.x, rect.y]).toEqual([0, 100])
    rect.resize(200, 50)
    expect([round(rect.x), round(rect.y)]).toEqual([0, 100])
    expect(box(rect.absoluteBoundingBox)).toEqual([0, 0, 198.205, 143.301])
  })

  test('relativeTransform can be set', () => {
    const { rect } = rectangle()
    const [cos, sin] = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)]
    rect.relativeTransform = [
      [cos, sin, 10],
      [-sin, cos, 20]
    ]
    expect([round(rect.x), round(rect.y), round(rect.rotation)]).toEqual([10, 20, 30])
  })

  test('a line turns about its start', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const line = figma.createLine()
    line.rotation = 90
    expect(line.relativeTransform).toEqual([
      [0, 1, 0],
      [-1, 0, 0]
    ])
    expect(box(line.absoluteBoundingBox)).toEqual([0, -100, 0, 100])
  })
})

describe('plugin API appendChild', () => {
  test('a moved node keeps its x, y, and rotation in its new parent', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const frame = figma.createFrame()
    frame.x = 500
    frame.y = 40
    const rect = figma.createRectangle()
    rect.x = 10
    rect.y = 20
    frame.appendChild(rect)
    expect([rect.x, rect.y]).toEqual([10, 20])
    expect(rect.absoluteTransform).toEqual([
      [1, 0, 510],
      [0, 1, 60]
    ])

    const turned = figma.createFrame()
    turned.x = 800
    turned.resize(200, 200)
    turned.rotation = 90
    rect.rotation = 15
    turned.appendChild(rect)
    expect([round(rect.x), round(rect.y), round(rect.rotation)]).toEqual([10, 20, 15])
    expect(rounded(rect.absoluteTransform)).toEqual([
      [-0.259, 0.966, 820],
      [-0.966, -0.259, -10]
    ])

    figma.currentPage.appendChild(rect)
    expect([round(rect.x), round(rect.y), round(rect.rotation)]).toEqual([10, 20, 15])
  })

  test('insertChild keeps x and y too', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const frame = figma.createFrame()
    frame.x = 500
    frame.appendChild(figma.createEllipse())
    const rect = figma.createRectangle()
    rect.x = 30
    rect.y = 40
    frame.insertChild(0, rect)
    expect([rect.x, rect.y, frame.children.indexOf(rect)]).toEqual([30, 40, 0])
  })
})
