import { afterAll, describe, expect, spyOn, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { renderRow } from '#core-tests/helpers/figma-rows'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Stroke } from '@open-pencil/scene-graph'

import { makeBooleanOperationPath } from '#core/canvas/boolean'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const SIZE = 160
const WEIGHT = 8
const RED = { r: 1, g: 0, b: 0, a: 1 }

/** The opacities of the operand's fill and stroke. */
interface OperandOpacity {
  fill: number
  stroke: number
}

function unionWithStrokedOperand(
  align: Stroke['align'],
  operandFillVisible: boolean,
  opacity: OperandOpacity = { fill: 1, stroke: 1 }
) {
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
      fills: [{ type: 'SOLID', color: RED, opacity: opacity.fill, visible: operandFillVisible }],
      strokes: [
        { type: 'SOLID', color: RED, opacity: opacity.stroke, visible: true, weight: WEIGHT, align }
      ],
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

function leftEdgeAlpha(
  align: Stroke['align'],
  operandFillVisible: boolean,
  opacity?: OperandOpacity
): number[] {
  const scene = unionWithStrokedOperand(align, operandFillVisible, opacity)
  return renderRow(ck, renderer, scene, 150, 104, 134)
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

  // A paint at 0% shapes nothing, as a hidden one (live-verified).
  test('adds only its stroke band when its fill is at 0%', () => {
    expect(leftEdgeAlpha('INSIDE', true, { fill: 0, stroke: 1 })).toEqual(
      leftEdgeAlpha('INSIDE', false)
    )
  })

  test('adds its whole area when its fill is hidden and its stroke at 0%', () => {
    expect(leftEdgeAlpha('INSIDE', false, { fill: 1, stroke: 0 })).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255
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

function insideStrokedSquareWithTail(graph: SceneGraph, hostId: string) {
  const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
    x: 120,
    y: 70,
    width: SIZE,
    height: SIZE,
    booleanOperation: 'UNION',
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  const zero = { x: 0, y: 0 }
  const edge = (start: number, end: number) => ({
    start,
    end,
    tangentStart: zero,
    tangentEnd: zero
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
      vertices: [...box(0, 0, SIZE, SIZE), [SIZE, SIZE + 40] as const].map(([x, y]) => ({ x, y })),
      segments: [edge(0, 1), edge(1, 2), edge(2, 3), edge(3, 0), edge(2, 4)],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
    }
  })
}

function openOperandPath(cornerRadius: number) {
  const graph = new SceneGraph()
  const operation = graph.createNode('BOOLEAN_OPERATION', graph.getPages()[0].id, {
    width: SIZE,
    height: SIZE,
    booleanOperation: 'UNION',
    cornerRadius,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  const zero = { x: 0, y: 0 }
  graph.createNode('VECTOR', operation.id, {
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }],
    vectorNetwork: {
      vertices: box(0, 0, SIZE, SIZE)
        .slice(0, 3)
        .map(([x, y]) => ({ x, y })),
      segments: [
        { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
        { start: 1, end: 2, tangentStart: zero, tangentEnd: zero }
      ],
      regions: []
    }
  })
  return withFreshRenderer((fresh) =>
    expectDefined(makeBooleanOperationPath(fresh, operation, graph))
  )
}

function overlappingRegionsPathWithoutUnions() {
  const graph = new SceneGraph()
  unionWithOverlappingNetworkRegions(graph, graph.getPages()[0].id)
  const operation = expectDefined(graph.getNode(graph.getPages()[0].childIds[0]))
  const pathOps = spyOn(ck.Path, 'MakeFromOp').mockReturnValue(null)
  try {
    return withFreshRenderer((fresh) =>
      expectDefined(makeBooleanOperationPath(fresh, operation, graph))
    )
  } finally {
    pathOps.mockRestore()
  }
}

describe('a vector boolean operand whose regions do not unite', () => {
  test('keeps every region of its outline', () => {
    const path = overlappingRegionsPathWithoutUnions()
    expect([path.contains(20, 20), path.contains(140, 140)]).toEqual([true, true])
    path.delete()
  })
})

describe('a vector boolean operand with a region and a loose segment', () => {
  test('strokes the loose segment on its centre line', () => {
    expect(renderRow(ck, renderer, insideStrokedSquareWithTail, 250, 270, 290)).toEqual([
      0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0
    ])
  })
})

describe('a rounded boolean operation of a single open path', () => {
  test('fills the path with its corner rounded', () => {
    const path = openOperandPath(20)
    expect([path.contains(SIZE - 10, 10), path.contains(SIZE - 1, 1)]).toEqual([true, false])
    path.delete()
  })
})
