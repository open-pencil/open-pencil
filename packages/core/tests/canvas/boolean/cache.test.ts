import { describe, expect, spyOn, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'

import { makeBooleanOperationPath, makeBooleanSourcePath } from '#core/canvas/boolean'
import { NodePathCaches } from '#core/canvas/paths/cache'

import { expectDefined } from '#core-tests/helpers/assert'

const ck = await initCanvasKit()

const SIZE = 160
const RED = { r: 1, g: 0, b: 0, a: 1 }
const SOLID_RED = { type: 'SOLID' as const, color: RED, opacity: 1, visible: true }

function withFreshRenderer<T>(use: (fresh: SkiaRenderer) => T): T {
  const fresh = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
  try {
    return use(fresh)
  } finally {
    fresh.destroy()
  }
}

function countPathOps(build: () => void): number {
  const pathOps = spyOn(ck.Path, 'MakeFromOp')
  try {
    build()
    return pathOps.mock.calls.length
  } finally {
    pathOps.mockRestore()
  }
}

function pathOpsOnRepeatedBuild(build: (graph: SceneGraph, hostId: string) => string): number {
  const graph = new SceneGraph()
  const operation = expectDefined(graph.getNode(build(graph, graph.getPages()[0].id)))
  return withFreshRenderer((fresh) => {
    const buildPath = () => makeBooleanOperationPath(fresh, operation, graph)?.delete()
    buildPath()
    return countPathOps(buildPath)
  })
}

function squareBlob(left: number, top: number, side: number): Uint8Array {
  const corners = [
    [left, top],
    [left + side, top],
    [left + side, top + side],
    [left, top + side]
  ]
  const blob = new Uint8Array(corners.length * 9 + 1)
  const view = new DataView(blob.buffer)
  corners.forEach(([x, y], index) => {
    blob[index * 9] = index === 0 ? 1 : 2
    view.setFloat32(index * 9 + 1, x, true)
    view.setFloat32(index * 9 + 5, y, true)
  })
  return blob
}

function squareNetwork(): VectorNetwork {
  const corners = [
    { x: 0, y: 0 },
    { x: SIZE, y: 0 },
    { x: SIZE, y: SIZE },
    { x: 0, y: SIZE }
  ]
  const straight = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  return {
    vertices: corners,
    segments: corners.map((_, index) => ({ start: index, end: (index + 1) % 4, ...straight })),
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
  }
}

function unionWithVector(
  graph: SceneGraph,
  hostId: string,
  vector: Parameters<SceneGraph['createNode']>[2]
): string {
  const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
    width: SIZE,
    height: SIZE,
    booleanOperation: 'UNION',
    fills: [SOLID_RED]
  })
  graph.createNode('VECTOR', operation.id, { width: SIZE, height: SIZE, ...vector })
  return operation.id
}

function unionWithOverlappingRegionsOperand(graph: SceneGraph, hostId: string): string {
  return unionWithVector(graph, hostId, {
    fills: [SOLID_RED],
    vectorNetwork: { vertices: [], segments: [], regions: [] },
    fillGeometry: [
      { windingRule: 'NONZERO', commandsBlob: squareBlob(0, 0, 100) },
      { windingRule: 'NONZERO', commandsBlob: squareBlob(50, 50, 100) }
    ]
  })
}

function unionWithInsideStrokedVector(graph: SceneGraph, hostId: string): string {
  return unionWithVector(graph, hostId, {
    fills: [{ ...SOLID_RED, visible: false }],
    strokes: [{ ...SOLID_RED, weight: 8, align: 'INSIDE' }],
    strokeWeight: 8,
    strokeAlign: 'INSIDE',
    vectorNetwork: squareNetwork()
  })
}

function overlappingSquares(graph: SceneGraph, hostId: string): string {
  const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
    width: SIZE,
    height: SIZE,
    booleanOperation: 'UNION',
    fills: [SOLID_RED]
  })
  for (const x of [0, SIZE / 2]) {
    graph.createNode('RECTANGLE', operation.id, {
      x,
      width: SIZE / 2 + 10,
      height: SIZE,
      fills: [SOLID_RED]
    })
  }
  return operation.id
}

function resultAfterEdit(edit: (graph: SceneGraph, operationId: string) => void): {
  rebuilt: number[]
  fresh: number[]
} {
  const graph = new SceneGraph()
  const operationId = overlappingSquares(graph, graph.getPages()[0].id)
  const bounds = (r: SkiaRenderer) => {
    const path = expectDefined(
      makeBooleanOperationPath(r, expectDefined(graph.getNode(operationId)), graph)
    )
    const tight = Array.from(path.computeTightBounds())
    path.delete()
    return tight
  }
  return withFreshRenderer((cached) => {
    bounds(cached)
    edit(graph, operationId)
    return { rebuilt: bounds(cached), fresh: withFreshRenderer(bounds) }
  })
}

function operandIds(graph: SceneGraph, operationId: string): string[] {
  return expectDefined(graph.getNode(operationId)).childIds
}

describe('a boolean operation’s result', () => {
  test('is combined once while its operands stay the same', () => {
    expect(pathOpsOnRepeatedBuild(overlappingSquares)).toBe(0)
  })

  test('is shared by operations whose operands match', () => {
    const graph = new SceneGraph()
    const hostId = graph.getPages()[0].id
    const first = expectDefined(graph.getNode(overlappingSquares(graph, hostId)))
    const second = expectDefined(graph.getNode(overlappingSquares(graph, hostId)))
    withFreshRenderer((fresh) => {
      makeBooleanOperationPath(fresh, first, graph)?.delete()
      expect(countPathOps(() => makeBooleanOperationPath(fresh, second, graph)?.delete())).toBe(0)
    })
  })

  test('follows a moved operand', () => {
    const { rebuilt, fresh } = resultAfterEdit((graph, operationId) => {
      graph.updateNode(operandIds(graph, operationId)[1], { x: SIZE })
    })
    expect(rebuilt).toEqual(fresh)
    expect(rebuilt).toEqual([0, 0, SIZE * 1.5 + 10, SIZE])
  })

  test('follows a resized operand', () => {
    const { rebuilt, fresh } = resultAfterEdit((graph, operationId) => {
      graph.updateNode(operandIds(graph, operationId)[1], { height: SIZE * 2 })
    })
    expect(rebuilt).toEqual(fresh)
    expect(rebuilt).toEqual([0, 0, SIZE + 10, SIZE * 2])
  })

  test('follows a change of its corner radius', () => {
    const graph = new SceneGraph()
    const operationId = overlappingSquares(graph, graph.getPages()[0].id)
    const coversOuterCorner = (r: SkiaRenderer) => {
      const operation = expectDefined(graph.getNode(operationId))
      const path = expectDefined(makeBooleanOperationPath(r, operation, graph))
      const covered = path.contains(1, 1)
      path.delete()
      return covered
    }
    withFreshRenderer((cached) => {
      expect(coversOuterCorner(cached)).toBe(true)
      graph.updateNode(operationId, { cornerRadius: 20 })
      expect(coversOuterCorner(cached)).toBe(false)
    })
  })

  test('follows a hidden operand', () => {
    const { rebuilt, fresh } = resultAfterEdit((graph, operationId) => {
      graph.updateNode(operandIds(graph, operationId)[1], { visible: false })
    })
    expect(rebuilt).toEqual(fresh)
    expect(rebuilt).toEqual([0, 0, SIZE / 2 + 10, SIZE])
  })

  test('follows an added operand', () => {
    const { rebuilt, fresh } = resultAfterEdit((graph, operationId) => {
      graph.createNode('RECTANGLE', operationId, {
        x: SIZE,
        width: SIZE,
        height: 10,
        fills: [SOLID_RED]
      })
    })
    expect(rebuilt).toEqual(fresh)
    expect(rebuilt).toEqual([0, 0, SIZE * 2, SIZE])
  })

  test('follows reordered operands of a subtraction', () => {
    const { rebuilt, fresh } = resultAfterEdit((graph, operationId) => {
      graph.updateNode(operationId, { booleanOperation: 'SUBTRACT' })
      graph.insertChildAt(operandIds(graph, operationId)[1], operationId, 0)
    })
    expect(rebuilt).toEqual(fresh)
    expect(rebuilt).toEqual([SIZE / 2 + 10, 0, SIZE + 10, SIZE])
  })

  test('follows a change of its operation', () => {
    const { rebuilt, fresh } = resultAfterEdit((graph, operationId) => {
      graph.updateNode(operationId, { booleanOperation: 'INTERSECT' })
    })
    expect(rebuilt).toEqual(fresh)
    expect(rebuilt).toEqual([SIZE / 2, 0, SIZE / 2 + 10, SIZE])
  })
})

function pathOpsForSecondOperand(build: (graph: SceneGraph, hostId: string) => string): number {
  const graph = new SceneGraph()
  const hostId = graph.getPages()[0].id
  const [first, second] = [build(graph, hostId), build(graph, hostId)].map((operationId) =>
    expectDefined(graph.getNode(expectDefined(graph.getNode(operationId)).childIds[0]))
  )
  return withFreshRenderer((fresh) => {
    makeBooleanSourcePath(fresh, first, graph)?.delete()
    return countPathOps(() => makeBooleanSourcePath(fresh, second, graph)?.delete())
  })
}

describe('a vector boolean operand’s shared outlines', () => {
  test('merge another vector’s identical saved fill without path ops', () => {
    expect(pathOpsForSecondOperand(unionWithOverlappingRegionsOperand)).toBe(0)
  })

  test('reuse another vector’s identical aligned stroke band', () => {
    expect(pathOpsForSecondOperand(unionWithInsideStrokedVector)).toBe(0)
  })
})

describe('a renderer whose path budget holds two entries', () => {
  test('builds every operation as an unbounded one does, without freeing a path twice', () => {
    const graph = new SceneGraph()
    const hostId = graph.getPages()[0].id
    const operations = [
      overlappingSquares(graph, hostId),
      unionWithInsideStrokedVector(graph, hostId),
      overlappingSquares(graph, hostId)
    ].map((id) => expectDefined(graph.getNode(id)))
    const boundsWith = (r: SkiaRenderer) =>
      [0, 1, 2].flatMap(() =>
        operations.map((operation) => {
          const path = expectDefined(makeBooleanOperationPath(r, operation, graph))
          const tight = Array.from(path.computeTightBounds())
          path.delete()
          return tight
        })
      )
    const unbounded = withFreshRenderer(boundsWith)
    const bounded = withFreshRenderer((tiny) => {
      tiny.nodePaths = new NodePathCaches({ maxEntries: 2 })
      const built = boundsWith(tiny)
      expect(tiny.nodePaths.shared.size).toBeLessThanOrEqual(2)
      expect(tiny.nodePaths.sharedKeys.size).toBeLessThanOrEqual(2)
      tiny.nodePaths.clear()
      return built
    })
    expect(bounded).toEqual(unbounded)
  })
})
