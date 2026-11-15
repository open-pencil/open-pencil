import { afterEach, describe, expect, test } from 'bun:test'

import { createEditorWithRenderer, disposeFlattenEditors } from '#core-tests/helpers/flatten'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { vectorNetworkToPath } from '@open-pencil/core/vector'
import type { Stroke, VectorNetwork } from '@open-pencil/scene-graph'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'

afterEach(disposeFlattenEditors)

const RED: Color = { r: 1, g: 0, b: 0, a: 1 }
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 }
const solid = (color: Color) => ({ type: 'SOLID' as const, color, opacity: 1, visible: true })
const stroke = (align: Stroke['align']): Stroke => ({ ...solid(RED), weight: 4, align })

describe('outlineStrokeSelected on a vector network', () => {
  const network = (
    points: [number, number][],
    edges: [number, number][],
    loops: number[][]
  ): VectorNetwork => ({
    vertices: points.map(([x, y]) => ({ x, y })),
    segments: edges.map(([start, end]) => ({
      start,
      end,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })),
    regions: loops.map((loop) => ({ windingRule: 'NONZERO', loops: [loop] }))
  })
  const TRIANGLE_WITH_TAIL: [number, number][] = [
    [0, 10],
    [40, 10],
    [20, 40],
    [60, 0]
  ]
  const TRIANGLE_AND_TAIL_EDGES: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
    [1, 3]
  ]

  async function outlinedStroke(network: VectorNetwork, align: Stroke['align'] = 'CENTER') {
    const { editor } = await createEditorWithRenderer()
    const vector = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
      name: 'V',
      x: 50,
      y: 50,
      width: 60,
      height: 40,
      vectorNetwork: network,
      fills: [solid(BLUE)],
      strokes: [stroke(align)]
    })
    editor.select([vector.id])
    editor.outlineStrokeSelected()
    const children = editor.graph.getChildren(editor.state.currentPageId)
    const outline = children.find((node) => node.name === 'V (Stroke)')
    const fill = children.find((node) => node.name === 'V')
    if (!outline?.vectorNetwork || !fill) {
      throw new Error('No outlined layers')
    }
    return { outline, fill }
  }

  test('keeps the stroke of an open segment off a region, and fills only the region', async () => {
    const { outline, fill } = await outlinedStroke(
      network(TRIANGLE_WITH_TAIL, TRIANGLE_AND_TAIL_EDGES, [[0, 1, 2]])
    )
    expect(outline.x + outline.width).toBeGreaterThan(110)
    expect(outline.y).toBeLessThan(50)
    expect([fill.x, fill.y, fill.width, fill.height]).toEqual([50, 60, 40, 30])
  })

  test('fills only the regions of a vector with a straight open segment, as the canvas does', async () => {
    const smallTriangle: [number, number][] = [
      [15, 20],
      [25, 20],
      [20, 30]
    ]
    const smallTriangleEdges: [number, number][] = [
      [4, 5],
      [5, 6],
      [6, 4]
    ]
    const { fill } = await outlinedStroke(
      network(
        [...TRIANGLE_WITH_TAIL, ...smallTriangle],
        [...TRIANGLE_AND_TAIL_EDGES, ...smallTriangleEdges],
        [
          [0, 1, 2],
          [4, 5, 6]
        ]
      )
    )
    expect([fill.x, fill.y, fill.width, fill.height]).toEqual([50, 60, 40, 30])
    expect(fill.vectorNetwork?.regions.map((region) => region.windingRule)).toEqual(['NONZERO'])
  })

  const splitSquare = network(
    [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40]
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2]
    ],
    [
      [0, 1, 4],
      [4, 2, 3]
    ]
  )

  async function strokeCovers(align: Stroke['align'], points: Vector[]) {
    const { outline } = await outlinedStroke(splitSquare, align)
    const ck = await getCanvasKit()
    const [path] = vectorNetworkToPath(ck, expectDefined(outline.vectorNetwork))
    const covered = points.map(({ x, y }) => path.contains(50 + x - outline.x, 50 + y - outline.y))
    path.delete()
    return covered
  }

  const fromCorner = (degrees: number, distance: number) => ({
    x: Math.cos((degrees * Math.PI) / 180) * distance,
    y: Math.sin((degrees * Math.PI) / 180) * distance
  })

  test('keeps the stroke of an edge two regions share', async () => {
    expect(await strokeCovers('CENTER', [{ x: 20, y: 20 }])).toEqual([true])
  })

  test('strokes an edge two regions share at its own weight, as the canvas does', async () => {
    const threeOffTheDiagonal = { x: 20 + 3 / Math.SQRT2, y: 20 - 3 / Math.SQRT2 }
    const oneOffTheDiagonal = { x: 20 + 1 / Math.SQRT2, y: 20 - 1 / Math.SQRT2 }
    expect(await strokeCovers('INSIDE', [threeOffTheDiagonal, oneOffTheDiagonal])).toEqual([
      false,
      true
    ])
  })

  test('joins the outline at a corner where regions meet, without their miters', async () => {
    expect(await strokeCovers('CENTER', [fromCorner(202.5, 3), fromCorner(247.5, 3)])).toEqual([
      false,
      false
    ])
  })
})
