import { describe, expect, test } from 'bun:test'

import { initCanvasKit } from '#cli/headless'
import { BLACK } from '#core/constants'
import { makeBooleanOperationPath } from '#core/canvas/boolean'
import { makeNodeShapePath, makePolygonPath, makeRRect } from '#core/canvas/shapes'
import type { SkiaRenderer } from '#core/canvas/renderer'

import { createAPI } from '#tests/engine/figma/api/helpers'

async function createRenderer(): Promise<SkiaRenderer> {
  const ck = await initCanvasKit()
  const renderer = {
    ck,
    makeNodeShapePath(node, rect, hasRadius) {
      return makeNodeShapePath(this, node, rect, hasRadius)
    },
    makePolygonPath(node) {
      return makePolygonPath(this, node)
    },
    makeRRect(node) {
      return makeRRect(this, node)
    },
    getVectorPaths() {
      return null
    }
  } satisfies Partial<SkiaRenderer>
  return renderer as SkiaRenderer
}

describe('boolean operation paths', () => {
  test('union combines child shapes into one outline', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    first.resize(100, 100)
    second.resize(100, 100)
    second.x = 50

    const booleanNode = api.union([first, second], api.currentPage)
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([0, 0, 150, 100]))
    path?.delete()
  })

  test('subtract keeps the lead child bounds', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    first.resize(100, 100)
    second.resize(50, 100)
    second.x = 50

    const booleanNode = api.subtract([first, second], api.currentPage)
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([0, 0, 50, 100]))
    path?.delete()
  })

  test('exclude creates an xor outline', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    first.resize(100, 100)
    second.resize(100, 100)
    second.x = 50

    const booleanNode = api.exclude([first, second], api.currentPage)
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([0, 0, 150, 100]))
    path?.delete()
  })

  test('intersect supports transformed children', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    first.resize(100, 100)
    second.resize(100, 100)
    second.x = 50
    second.flipX = true

    const booleanNode = api.intersect([first, second], api.currentPage)
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([50, 0, 100, 100]))
    path?.delete()
  })

  test('supports ellipse arc wedges', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createEllipse()
    const second = api.createEllipse()
    first.resize(100, 100)
    second.resize(100, 100)
    second.x = 50
    const firstNode = api.graph.getNode(first.id)
    const secondNode = api.graph.getNode(second.id)
    expect(firstNode).toBeDefined()
    expect(secondNode).toBeDefined()
    if (!firstNode || !secondNode) return
    firstNode.arcData = { startingAngle: 0, endingAngle: Math.PI, innerRadius: 0 }
    secondNode.arcData = { startingAngle: 0, endingAngle: Math.PI, innerRadius: 0 }

    const booleanNode = api.union([first, second], api.currentPage)
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([0, 50, 150, 100]))
    path?.delete()
  })

  test('turns lines into stroke outlines', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createLine()
    const second = api.createLine()
    first.resize(100, 100)
    second.resize(100, 100)
    second.x = 50
    const firstNode = api.graph.getNode(first.id)
    const secondNode = api.graph.getNode(second.id)
    expect(firstNode).toBeDefined()
    expect(secondNode).toBeDefined()
    if (!firstNode || !secondNode) return
    firstNode.strokes = [{ type: 'SOLID', color: BLACK, opacity: 1, visible: true, weight: 12, align: 'CENTER' }]
    secondNode.strokes = [{ type: 'SOLID', color: BLACK, opacity: 1, visible: true, weight: 12, align: 'CENTER' }]

    const booleanNode = api.union([first, second], api.currentPage)
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)
    const bounds = path?.getBounds()

    expect(bounds?.[2]).toBeGreaterThan(145)
    expect(bounds?.[3]).toBeGreaterThan(100)
    path?.delete()
  })

  test('supports nested boolean operation children', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    const third = api.createEllipse()
    first.resize(100, 100)
    second.resize(100, 100)
    second.x = 50
    third.resize(50, 50)
    third.x = 125

    const union = api.union([first, second], api.currentPage)
    const booleanNode = api.union([union, third], api.currentPage)
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([0, 0, 175, 100]))
    path?.delete()
  })
})
