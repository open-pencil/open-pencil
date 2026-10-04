import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#core-tests/helpers/assert'
import { collectAllNodes } from '#core-tests/helpers/fig/traversal'

setDefaultTimeout(60_000)

const STOPS = [
  { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
  { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
]
const TRANSFORM = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }

async function reImport(graph: SceneGraph): Promise<SceneGraph> {
  const bytes = await exportFigFile(graph)
  return await parseFigFile(bytes.buffer as ArrayBuffer)
}

function strokeOf(graph: SceneGraph, name: string) {
  const node = collectAllNodes(graph).find((candidate) => candidate.name === name)
  return expectDefined(node, `node ${name}`).strokes[0]
}

/** A stroke is a paint, so a gradient or image stroke has to survive the archive like a fill. */
describe('roundtrip: stroke paints', () => {
  test('a gradient stroke keeps its stops and transform', async () => {
    await initCodec()
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Gradient stroke',
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          gradientStops: STOPS,
          gradientTransform: TRANSFORM,
          weight: 4,
          opacity: 1,
          visible: true,
          align: 'OUTSIDE'
        }
      ]
    })

    const stroke = strokeOf(await reImport(graph), 'Gradient stroke')

    expect(stroke.type).toBe('GRADIENT_LINEAR')
    expect(stroke.gradientStops?.map((stop) => stop.position)).toEqual([0, 1])
    expect(expectDefined(stroke.gradientStops?.[0], 'first stop').color).toMatchObject({
      r: 1,
      g: 0,
      b: 0
    })
    expect(stroke.gradientTransform).toMatchObject({ m00: 1, m11: 1 })
    expect(stroke).toMatchObject({ weight: 4, align: 'OUTSIDE' })
  })

  test('an image stroke keeps its hash and scale mode', async () => {
    await initCodec()
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Image stroke',
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          imageHash: 'abc123',
          imageScaleMode: 'FIT',
          weight: 3,
          opacity: 1,
          visible: true,
          align: 'CENTER'
        }
      ]
    })

    const stroke = strokeOf(await reImport(graph), 'Image stroke')

    expect(stroke.type).toBe('IMAGE')
    expect(stroke.imageHash).toBe('abc123')
    expect(stroke.imageScaleMode).toBe('FIT')
    expect(stroke).toMatchObject({ weight: 3, align: 'CENTER' })
  })

  test('a solid stroke still round-trips unchanged', async () => {
    await initCodec()
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Solid stroke',
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
          weight: 2,
          opacity: 0.5,
          visible: true,
          align: 'INSIDE'
        }
      ]
    })

    const stroke = strokeOf(await reImport(graph), 'Solid stroke')

    expect(stroke.type).toBe('SOLID')
    // The archive stores colours as float32, so compare approximately.
    expect(stroke.color.r).toBeCloseTo(0.2, 5)
    expect(stroke.color.g).toBeCloseTo(0.4, 5)
    expect(stroke.color.b).toBeCloseTo(0.6, 5)
    expect(stroke).toMatchObject({ weight: 2, opacity: 0.5, align: 'INSIDE' })
  })
})
