import { describe, expect, spyOn, test } from 'bun:test'

import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { initCanvasKit } from '#cli/headless'
import { makeBooleanOperationPath } from '#core/canvas/boolean'
import { NodePathCaches } from '#core/canvas/paths/cache'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { makeNodeShapePath, makePolygonPath, makeRRect } from '#core/canvas/shapes'
import { BLACK } from '#core/constants'

import { asPageNode, createAPI } from '#tests/helpers/plugin-api'

import { asRenderer } from './helpers'

async function createRenderer(): Promise<SkiaRenderer> {
  const ck = await initCanvasKit()
  const renderer = {
    ck,
    nodePaths: new NodePathCaches(),
    makeNodeShapePath(node) {
      return makeNodeShapePath(asRenderer(this), node)
    },
    makePolygonPath(node) {
      return makePolygonPath(asRenderer(this), node)
    },
    makeRRect(node) {
      return makeRRect(asRenderer(this), node)
    },
    getVectorPaths() {
      return null
    },
    getFillGeometry() {
      return null
    }
  } satisfies Partial<SkiaRenderer>
  return asRenderer(renderer)
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

    const booleanNode = api.union([first, second], asPageNode(api.currentPage))
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

    const booleanNode = api.subtract([first, second], asPageNode(api.currentPage))
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

    const booleanNode = api.exclude([first, second], asPageNode(api.currentPage))
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
    api.graph.updateNode(second.id, { flipX: true })

    const booleanNode = api.intersect([first, second], asPageNode(api.currentPage))
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([50, 0, 100, 100]))
    path?.delete()
  })

  test('reflects a turned child after turning it, as the canvas places it', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    for (const stick of [first, second]) {
      stick.resize(160, 20)
      stick.y = 70
    }
    api.graph.updateNode(first.id, { rotation: 45 })
    api.graph.updateNode(second.id, { rotation: 45, flipX: true })

    const booleanNode = api.union([first, second], asPageNode(api.currentPage))
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)
    const crossing = (x: number) => path?.contains(x, 30)

    expect([crossing(30), crossing(node.width - 30)]).toEqual([true, true])
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

    const booleanNode = api.union([first, second], asPageNode(api.currentPage))
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
    firstNode.strokes = [
      { type: 'SOLID', color: BLACK, opacity: 1, visible: true, weight: 12, align: 'CENTER' }
    ]
    secondNode.strokes = [
      { type: 'SOLID', color: BLACK, opacity: 1, visible: true, weight: 12, align: 'CENTER' }
    ]

    const booleanNode = api.union([first, second], asPageNode(api.currentPage))
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)
    const bounds = path?.getBounds()

    // A line is stroked to its upper side, so the outline reaches past it to the right.
    expect(bounds?.[2]).toBeGreaterThan(150)
    expect(bounds?.[3]).toBeCloseTo(100, 3)
    path?.delete()
  })

  test('uses imported fill geometry when child paths cannot produce a boolean path', async () => {
    const r = await createRenderer()
    const importedPathBuilder = new r.ck.PathBuilder()
    importedPathBuilder.addRect(r.ck.LTRBRect(5, 6, 25, 36))
    const importedPath = importedPathBuilder.detachAndDelete()
    r.getFillGeometry = () => [importedPath]
    const node = createDefaultNode(() => 'boolean', 'BOOLEAN_OPERATION', {
      childIds: [],
      booleanOperation: 'UNION'
    })
    const api = createAPI()

    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([5, 6, 25, 36]))
    path?.delete()
    importedPath.delete()
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

    const union = api.union([first, second], asPageNode(api.currentPage))
    const booleanNode = api.union([union, third], asPageNode(api.currentPage))
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect(path?.getBounds()).toEqual(new Float32Array([0, 0, 175, 100]))
    path?.delete()
  })

  test('rounds the combined outline by the operation’s own corner radius', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    first.resize(100, 100)
    second.resize(50, 50)
    second.x = 100

    const booleanNode = api.union([first, second], asPageNode(api.currentPage))
    api.graph.updateNode(booleanNode.id, { cornerRadius: 20 })
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    const path = makeBooleanOperationPath(r, node, api.graph)

    expect([path?.contains(2, 2), path?.contains(2, 50), path?.contains(125, 25)]).toEqual([
      false,
      true,
      true
    ])
    path?.delete()
  })

  test('rounds an unchanged outline once, not on every frame', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    first.resize(100, 100)
    second.resize(50, 50)
    second.x = 100
    const booleanNode = api.union([first, second], asPageNode(api.currentPage))
    api.graph.updateNode(booleanNode.id, { cornerRadius: 20 })
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    makeBooleanOperationPath(r, node, api.graph)?.delete()

    const outlineReads = spyOn(r.ck.Path.prototype, 'toSVGString')
    try {
      makeBooleanOperationPath(r, node, api.graph)?.delete()
      expect(outlineReads).not.toHaveBeenCalled()
    } finally {
      outlineReads.mockRestore()
    }
  })

  test('rounds the outline again after an operand changes', async () => {
    const r = await createRenderer()
    const api = createAPI()
    const first = api.createRectangle()
    const second = api.createRectangle()
    first.resize(100, 100)
    second.resize(50, 50)
    second.x = 100
    const booleanNode = api.union([first, second], asPageNode(api.currentPage))
    api.graph.updateNode(booleanNode.id, { cornerRadius: 20 })
    const node = api.graph.getNode(booleanNode.id)
    expect(node).toBeDefined()
    if (!node) return
    makeBooleanOperationPath(r, node, api.graph)?.delete()

    second.resize(80, 50)
    const path = makeBooleanOperationPath(r, node, api.graph)
    const bounds = path?.computeTightBounds()

    expect(bounds && bounds[2] - bounds[0]).toBe(180)
    path?.delete()
  })
})
