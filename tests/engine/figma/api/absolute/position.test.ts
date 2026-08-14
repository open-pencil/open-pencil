import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

describe('absolute position', () => {
  test('relative and absolute transforms include rotation and reflection', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.x = 100
    parent.y = 200
    const child = api.createRectangle()
    parent.appendChild(child)
    child.x = 10
    child.y = 20
    child.resize(50, 30)
    child.rotation = 90

    expect(child.relativeTransform).toEqual([
      [0, -1, 50],
      [1, 0, 10]
    ])
    expect(child.absoluteTransform).toEqual([
      [0, -1, 150],
      [1, 0, 210]
    ])
  })

  test('exposes preserved FIG reflection transforms and Figma rotation', () => {
    const api = createAPI()
    const node = api.createVector()
    const raw = api.graph.getNode(node.id)
    expect(raw).toBeDefined()
    if (!raw) return
    api.graph.updateNode(node.id, {
      x: 5,
      y: 8,
      width: 14,
      height: 8,
      rotation: -180,
      flipX: true,
      source: {
        ...raw.source,
        format: 'fig',
        id: '94:5463',
        fig: {
          ...raw.source.fig,
          rawTransform: { m00: 1, m01: 0, m02: 5, m10: 0, m11: -1, m12: 16 }
        }
      }
    })

    expect(node.x).toBe(5)
    expect(node.y).toBe(8)
    expect(node.rotation).toBe(-0)
    expect(node.relativeTransform).toEqual([
      [1, 0, 5],
      [0, -1, 16]
    ])
    expect(node.absoluteTransform).toEqual([
      [1, 0, 5],
      [0, -1, 16]
    ])
  })

  test('absoluteBoundingBox accounts for nesting', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.x = 100
    parent.y = 200
    const child = api.createRectangle()
    parent.appendChild(child)
    child.x = 10
    child.y = 20
    child.resize(50, 30)
    const bounds = child.absoluteBoundingBox
    expect(bounds.x).toBe(110)
    expect(bounds.y).toBe(220)
    expect(bounds.width).toBe(50)
    expect(bounds.height).toBe(30)
  })
})
