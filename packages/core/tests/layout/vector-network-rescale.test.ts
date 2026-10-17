import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { rescaleVectorNetworkForLayout } from '#core/layout/apply'
import { computeAllLayouts } from '@open-pencil/core/layout'
import {
  fillSizingFields,
  SceneGraph,
  type SceneNode,
  type VectorNetwork
} from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

function at<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value')
  return value
}

/** A closed square whose vertices span `size`, as `.pen` bakes a path at the size it was drawn. */
function square(size: number): VectorNetwork {
  const corners = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size }
  ]
  return {
    vertices: corners.map((corner) => ({ ...corner })),
    segments: corners.map((_, index) => ({
      start: index,
      end: (index + 1) % corners.length,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })),
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
  }
}

function geometryBox(network: VectorNetwork) {
  const xs = network.vertices.map((vertex) => vertex.x)
  const ys = network.vertices.map((vertex) => vertex.y)
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  }
}

/**
 * A fixed 16×16 column holding one vector. By default the vector stretches across the counter
 * axis, so the layout gives it a width the geometry it was drawn at does not match.
 */
function columnWith(overrides: Partial<SceneNode>): SceneGraph {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, {
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    width: 16,
    height: 16
  })
  graph.createNode('VECTOR', frame.id, {
    width: 64,
    height: 64,
    vectorNetwork: square(64),
    ...fillSizingFields('VERTICAL', 'HORIZONTAL'),
    ...overrides
  })
  return graph
}

function vectorOf(graph: SceneGraph): SceneNode {
  return at([...graph.getAllNodes()].find((node) => node.type === 'VECTOR'))
}

describe('a vector whose size the layout changes', () => {
  test('follows each axis the layout changes, so it stays inside its box', () => {
    const graph = columnWith({})
    computeAllLayouts(graph)
    const vector = vectorOf(graph)

    // The column stretches the counter axis only, so the width follows it and the height stays.
    expect(Math.round(vector.width)).toBe(16)
    expect(Math.round(vector.height)).toBe(64)
    expect(geometryBox(at(vector.vectorNetwork ?? undefined))).toEqual({ width: 16, height: 64 })
  })

  test('keeps its geometry when the layout leaves its size alone', () => {
    const graph = columnWith({
      layoutAlignSelf: 'AUTO',
      layoutGrow: 0,
      width: 16,
      height: 16,
      vectorNetwork: square(16)
    })
    computeAllLayouts(graph)
    const vector = vectorOf(graph)

    expect(Math.round(vector.width)).toBe(16)
    expect(geometryBox(at(vector.vectorNetwork ?? undefined))).toEqual({ width: 16, height: 16 })
  })
})

/** The fill the drawn tiles below use, so a painted pixel is a pixel the path drew. */
const BLACK_FILL = {
  type: 'SOLID' as const,
  visible: true,
  opacity: 1,
  color: { r: 0, g: 0, b: 0, a: 1 }
}

/**
 * A 64×64 tile holding a 16-wide column with a path stretched across it, so the geometry the path
 * was drawn at (64) and the box the layout gives it (16) are told apart on screen.
 */
function tileWithStretchedPath(): { graph: SceneGraph; tileSize: number; tileId: string } {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const tile = graph.createNode('FRAME', page, {
    width: 64,
    height: 64,
    fills: [],
    clipsContent: false
  })
  const column = graph.createNode('FRAME', tile.id, {
    width: 16,
    height: 64,
    fills: [],
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  graph.createNode('VECTOR', column.id, {
    width: 64,
    height: 64,
    vectorNetwork: square(64),
    fills: [BLACK_FILL],
    ...fillSizingFields('VERTICAL', 'HORIZONTAL')
  })
  return { graph, tileSize: 64, tileId: tile.id }
}

/** The alpha the tile draws at one point, read back from a 1× render of it. */
function alphaAt(graph: SceneGraph, tileId: string, tileSize: number, x: number, y: number) {
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [tileId], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const offset = (image.width() - tileSize) / 2
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: image.width(),
        height: image.height(),
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    return pixels[((y + offset) * image.width() + x + offset) * 4 + 3]
  } finally {
    image.delete()
  }
}

/** A column that starts with no width, which is the state a collapse leaves behind. */
function collapsedColumn(): SceneGraph {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, {
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    width: 0,
    height: 64
  })
  graph.createNode('VECTOR', frame.id, {
    width: 64,
    height: 64,
    vectorNetwork: square(64),
    ...fillSizingFields('VERTICAL', 'HORIZONTAL')
  })
  return graph
}

describe('a path whose box the layout collapses', () => {
  test('keeps its geometry instead of flattening it into a zero box', () => {
    const graph = collapsedColumn()
    computeAllLayouts(graph)
    const vector = vectorOf(graph)

    expect(Math.round(vector.width)).toBe(0)
    expect(geometryBox(at(vector.vectorNetwork ?? undefined))).toEqual({ width: 64, height: 64 })
  })

  test('rescales the geometry it kept once the box has a size again', () => {
    // The rule the layout write calls, from the state a collapse leaves: no box, geometry intact.
    const restored = at(rescaleVectorNetworkForLayout(square(64), 0, 0, 16, 64))

    expect(geometryBox(restored)).toEqual({ width: 16, height: 64 })
  })

  test('leaves the geometry alone while the target box has no size', () => {
    expect(rescaleVectorNetworkForLayout(square(64), 64, 64, 0, 64)).toBeNull()
  })
})

describe('a path the layout resized, on screen', () => {
  test('draws inside the box the layout gave it', () => {
    const { graph, tileId, tileSize } = tileWithStretchedPath()
    computeAllLayouts(graph)

    expect(alphaAt(graph, tileId, tileSize, 8, 8)).toBe(255)
  })

  test('stops painting where the geometry it was drawn at used to reach', () => {
    const { graph, tileId, tileSize } = tileWithStretchedPath()
    computeAllLayouts(graph)

    // The 64-wide geometry painted here; the 16-wide box the layout gives it does not.
    expect(alphaAt(graph, tileId, tileSize, 40, 8)).toBe(0)
  })
})
