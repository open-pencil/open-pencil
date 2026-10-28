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

function unionWithOpenStrokedOperand(graph: SceneGraph, hostId: string) {
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
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: false }],
    strokes: [
      { type: 'SOLID', color: RED, opacity: 1, visible: true, weight: WEIGHT, align: 'CENTER' }
    ],
    strokeWeight: WEIGHT,
    strokeAlign: 'CENTER',
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: SIZE, y: 0 },
        { x: SIZE, y: SIZE }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    },
    fillGeometry: [
      {
        windingRule: 'NONZERO',
        commandsBlob: contoursBlob([
          [
            [0, 0],
            [SIZE, 0],
            [SIZE, SIZE]
          ]
        ])
      }
    ]
  })
}

describe('a vector boolean operand’s stroke', () => {
  test('follows its open path, without the edge that closes its fill', () => {
    expect(renderRow(ck, renderer, unionWithOpenStrokedOperand, 150, 190, 210)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ])
  })
})

function unionWithOverlappingRegionsOperand(graph: SceneGraph, hostId: string) {
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
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }],
    vectorNetwork: { vertices: [], segments: [], regions: [] },
    fillGeometry: [
      { windingRule: 'NONZERO', commandsBlob: contoursBlob([box(0, 0, 100, 100)]) },
      { windingRule: 'NONZERO', commandsBlob: contoursBlob([box(50, 50, 150, 150).reverse()]) }
    ]
  })
}

describe('a vector boolean operand with several fill regions', () => {
  test('covers their overlap whatever their directions', () => {
    expect(renderRow(ck, renderer, unionWithOverlappingRegionsOperand, 145, 170, 230)).toEqual(
      Array.from({ length: 31 }, () => 255)
    )
  })
})

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

describe('a vector boolean operand’s saved fill', () => {
  test('merges its regions once, not on every frame', () => {
    expect(
      pathOpsOnRepeatedBuild((graph, hostId) => {
        unionWithOverlappingRegionsOperand(graph, hostId)
        return graph.getNode(hostId)?.childIds.at(-1) ?? ''
      })
    ).toBe(0)
  })
})

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

type Point = readonly [x: number, y: number]

function box(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom]
  ]
}

function contoursBlob(contours: Point[][]): Uint8Array {
  const commands = contours.flatMap((points) => [
    ...points.map(([x, y], index) => [index === 0 ? 1 : 2, x, y]),
    [0, 0, 0]
  ])
  const blob = new Uint8Array(commands.reduce((length, [command]) => length + (command ? 9 : 1), 0))
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const [command, x, y] of commands) {
    blob[offset++] = command
    if (command) {
      view.setFloat32(offset, x, true)
      view.setFloat32(offset + 4, y, true)
      offset += 8
    }
  }
  return blob
}

function unionWithSavedFrameOperand(graph: SceneGraph, hostId: string) {
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
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }],
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: SIZE, y: 0 },
        { x: 0, y: SIZE }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    },
    fillGeometry: [
      {
        windingRule: 'EVENODD',
        commandsBlob: contoursBlob([box(0, 0, SIZE, SIZE), box(40, 40, SIZE - 40, SIZE - 40)])
      }
    ]
  })
  graph.createNode('RECTANGLE', operation.id, {
    width: 10,
    height: 10,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
}

function unionWithStrokedSavedOperand(graph: SceneGraph, hostId: string) {
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
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }],
    strokes: [
      { type: 'SOLID', color: RED, opacity: 1, visible: true, weight: WEIGHT, align: 'OUTSIDE' }
    ],
    strokeWeight: WEIGHT,
    strokeAlign: 'OUTSIDE',
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
      regions: []
    },
    fillGeometry: [
      { windingRule: 'NONZERO', commandsBlob: contoursBlob([box(0, 0, SIZE / 2, SIZE)]) }
    ]
  })
}

function unionWithOverlappingNetworkRegions(graph: SceneGraph, hostId: string) {
  const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
    x: 120,
    y: 70,
    width: SIZE,
    height: SIZE,
    booleanOperation: 'UNION',
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  const zero = { x: 0, y: 0 }
  const corners = [box(0, 0, 100, 100), box(50, 50, 150, 150).reverse()]
  graph.createNode('VECTOR', operation.id, {
    width: SIZE,
    height: SIZE,
    vectorNetwork: {
      vertices: corners.flat().map(([x, y]) => ({ x, y })),
      segments: [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
        start: index,
        end: index % 4 === 3 ? index - 3 : index + 1,
        tangentStart: zero,
        tangentEnd: zero
      })),
      regions: [
        { windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] },
        { windingRule: 'NONZERO', loops: [[4, 5, 6, 7]] }
      ]
    }
  })
}

describe('a vector boolean operand', () => {
  test('covers the overlap of its network regions whatever their directions', () => {
    expect(renderRow(ck, renderer, unionWithOverlappingNetworkRegions, 145, 170, 230)).toEqual(
      Array.from({ length: 31 }, () => 255)
    )
  })

  test('takes its stroke’s side from its saved fill geometry', () => {
    expect(renderRow(ck, renderer, unionWithStrokedSavedOperand, 74, 220, 260)).toEqual(
      Array.from({ length: 21 }, () => 255)
    )
  })

  test('takes its shape from its saved fill geometry, holes included', () => {
    expect(renderRow(ck, renderer, unionWithSavedFrameOperand, 150, 150, 170)).toEqual([
      255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0
    ])
  })
})

const BLUE_CHANNEL = 2

function strokedUnion(align: Stroke['align']) {
  return (graph: SceneGraph, hostId: string) => {
    const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
      x: 120,
      y: 70,
      width: SIZE,
      height: SIZE,
      booleanOperation: 'UNION',
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          weight: WEIGHT,
          align
        }
      ],
      strokeWeight: WEIGHT,
      strokeAlign: align
    })
    graph.createNode('RECTANGLE', operation.id, {
      width: SIZE,
      height: SIZE,
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', operation.id, {
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
    })
  }
}

function leftEdgeStroke(align: Stroke['align']): number[] {
  return renderRow(ck, renderer, strokedUnion(align), 150, 104, 134, BLUE_CHANNEL)
}

describe('a boolean operation’s own stroke', () => {
  test('lies outside the result when aligned outside', () => {
    expect(leftEdgeStroke('OUTSIDE')).toEqual([
      0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0
    ])
  })

  test('lies within the result when aligned inside', () => {
    expect(leftEdgeStroke('INSIDE')).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0
    ])
  })

  test('straddles the outline when centred', () => {
    expect(leftEdgeStroke('CENTER')).toEqual([
      0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0
    ])
  })
})
