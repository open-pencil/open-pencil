import { afterAll, describe, expect, spyOn, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Stroke } from '@open-pencil/scene-graph'

import { makeBooleanOperationPath } from '#core/canvas/boolean'

import { expectDefined } from '#core-tests/helpers/assert'
import { renderRow } from '#core-tests/helpers/figma-rows'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const SIZE = 160
const WEIGHT = 8
const RED = { r: 1, g: 0, b: 0, a: 1 }

function unionWithStrokedOperand(align: Stroke['align'], operandFillVisible: boolean) {
  return (graph: SceneGraph, hostId: string) => {
    const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
      x: 120,
      y: 70,
      width: SIZE,
      height: SIZE,
      booleanOperation: 'UNION',
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', operation.id, {
      width: SIZE,
      height: SIZE,
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: operandFillVisible }],
      strokes: [{ type: 'SOLID', color: RED, opacity: 1, visible: true, weight: WEIGHT, align }],
      strokeWeight: WEIGHT,
      strokeAlign: align
    })
    graph.createNode('RECTANGLE', operation.id, {
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
    })
  }
}

function unionWithOpenOutsideStroke(graph: SceneGraph, hostId: string) {
  const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
    x: 120,
    y: 70,
    width: SIZE,
    height: SIZE,
    booleanOperation: 'UNION',
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  graph.createNode('VECTOR', operation.id, {
    width: SIZE,
    height: SIZE,
    strokes: [
      { type: 'SOLID', color: RED, opacity: 1, visible: true, weight: WEIGHT, align: 'OUTSIDE' }
    ],
    strokeWeight: WEIGHT,
    strokeAlign: 'OUTSIDE',
    vectorNetwork: {
      vertices: [
        { x: 0, y: SIZE / 2 },
        { x: SIZE, y: SIZE / 2 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
  })
  graph.createNode('RECTANGLE', operation.id, {
    width: 10,
    height: 10,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
}

function leftEdgeAlpha(align: Stroke['align'], operandFillVisible: boolean): number[] {
  return renderRow(ck, renderer, unionWithStrokedOperand(align, operandFillVisible), 150, 104, 134)
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

function unionWithInsideStrokedVector(graph: SceneGraph, hostId: string) {
  const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
    width: SIZE,
    height: SIZE,
    booleanOperation: 'UNION',
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  graph.createNode('VECTOR', operation.id, {
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: false }],
    strokes: [
      { type: 'SOLID', color: RED, opacity: 1, visible: true, weight: WEIGHT, align: 'INSIDE' }
    ],
    strokeWeight: WEIGHT,
    strokeAlign: 'INSIDE',
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: SIZE, y: 0 },
        { x: SIZE, y: SIZE },
        { x: 0, y: SIZE }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
    }
  })
  return operation.id
}

function withFreshRenderer<T>(use: (fresh: SkiaRenderer) => T): T {
  const fresh = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
  try {
    return use(fresh)
  } finally {
    fresh.destroy()
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

describe('a boolean operand with a stroke, as Figma combines it', () => {
  test('adds only its inside stroke band when its fill is hidden', () => {
    expect(leftEdgeAlpha('INSIDE', false)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0
    ])
  })

  test('strokes an open vector operand on its centre line whatever the alignment', () => {
    expect(renderRow(ck, renderer, unionWithOpenOutsideStroke, 144, 190, 210)).toEqual(
      Array.from({ length: 11 }, () => 0)
    )
    expect(renderRow(ck, renderer, unionWithOpenOutsideStroke, 150, 190, 210)).toEqual(
      Array.from({ length: 11 }, () => 255)
    )
  })

  test('adds only its outside stroke band when its fill is hidden', () => {
    expect(leftEdgeAlpha('OUTSIDE', false)).toEqual([
      0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0
    ])
  })

  test('adds a centred stroke band across its outline when its fill is hidden', () => {
    expect(leftEdgeAlpha('CENTER', false)).toEqual([
      0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0
    ])
  })

  test('adds its visible fill with an outside stroke band around it', () => {
    expect(leftEdgeAlpha('OUTSIDE', true)).toEqual([
      0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
    ])
  })

  test('outlines a vector operand’s aligned stroke once, not on every frame', () => {
    expect(pathOpsOnRepeatedBuild(unionWithInsideStrokedVector)).toBe(0)
  })
})
