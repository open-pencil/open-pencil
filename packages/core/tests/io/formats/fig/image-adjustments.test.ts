import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@lawha/core/io/formats/fig'
import { fillToKiwiPaint, fromFigmaPaintFilter, toFigmaPaintFilter } from '@lawha/fig/node-change'
import { SceneGraph, type Fill, type ImageAdjustments } from '@lawha/scene-graph'

const HASH = 'a'.repeat(40)

function imageFill(adjustments?: ImageAdjustments): Fill {
  return {
    type: 'IMAGE',
    imageHash: HASH,
    imageScaleMode: 'FILL',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    ...(adjustments ? { adjustments } : {})
  }
}

async function roundTrip(fills: Fill[]): Promise<Fill[]> {
  const graph = new SceneGraph()
  graph.images.set(HASH, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
  graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    name: 'Photo',
    width: 100,
    height: 80,
    fills
  })
  const bytes = await exportFigFile(graph)
  const parsed = await parseFigFile(bytes.buffer as ArrayBuffer)
  const node = [...parsed.getAllNodes()].find((n) => n.name === 'Photo')
  if (!node) throw new Error('Photo layer lost')
  return node.fills
}

const ALL: ImageAdjustments = {
  exposure: 0.25,
  contrast: -0.5,
  brightness: 0.1,
  saturation: -0.75,
  vibrance: 0.4,
  temperature: 0.3,
  tint: -0.2,
  highlights: -0.6,
  shadows: 0.55,
  hue: 0.5,
  sharpen: 0.4,
  noise: 0.2,
  vignette: -0.3,
  invert: true,
  levels: { black: 0.1, white: 0.9, gamma: 1.4 },
  curve: [
    { x: 0, y: 0.05 },
    { x: 0.5, y: 0.6 },
    { x: 1, y: 0.95 }
  ]
}

describe('Figma paint filter mapping', () => {
  test("Figma's vibrance field is the editor's Saturation", () => {
    expect(toFigmaPaintFilter({ saturation: -0.5 })).toEqual({ vibrance: -0.5 })
    expect(fromFigmaPaintFilter({ vibrance: 0.3 })).toEqual({ saturation: 0.3 })
  })

  test('the eight shared adjustments map both ways; zeros are left out', () => {
    const shared: ImageAdjustments = {
      exposure: 0.1,
      contrast: 0.2,
      brightness: 0.3,
      temperature: -0.1,
      tint: 0.4,
      highlights: -0.2,
      shadows: 0.5,
      saturation: -0.3
    }
    expect(fromFigmaPaintFilter(toFigmaPaintFilter(shared))).toEqual(shared)
    expect(toFigmaPaintFilter({ exposure: 0, contrast: 0 })).toBeUndefined()
  })

  test('Lawha-only adjustments have no Figma field', () => {
    expect(toFigmaPaintFilter({ hue: 0.5, invert: true, vibrance: 0.2 })).toBeUndefined()
  })

  test('out-of-range values from a file are clamped', () => {
    expect(fromFigmaPaintFilter({ exposure: 4, contrast: -3 })).toEqual({
      exposure: 1,
      contrast: -1
    })
  })

  test("Figma's vignette maps to vignette; detail, which has no match, is ignored", () => {
    expect(fromFigmaPaintFilter({ detail: 0.5, vignette: 0.3 })).toEqual({ vignette: 0.3 })
  })
})

describe('.fig round trip', () => {
  test('every adjustment, including hue, invert, vibrance, levels and curve, survives save and reopen', async () => {
    const [fill] = await roundTrip([imageFill(ALL)])
    expect(fill.adjustments).toEqual(ALL)
  })

  test('each image fill keeps its own adjustments', async () => {
    const fills = await roundTrip([
      imageFill({ exposure: 0.5 }),
      imageFill(),
      imageFill({ hue: -0.25 })
    ])
    expect(fills.map((f) => f.adjustments)).toEqual([{ exposure: 0.5 }, undefined, { hue: -0.25 }])
  })

  test('an image without adjustments gains none', async () => {
    const [fill] = await roundTrip([imageFill()])
    expect(fill.adjustments).toBeUndefined()
  })
})

test("saving writes the shared adjustments in Figma's own paint filter, so Figma shows them", () => {
  const paint = fillToKiwiPaint(imageFill({ exposure: 0.2, saturation: -0.5, hue: 0.3 }))
  expect(paint.paintFilter).toEqual({ exposure: 0.2, vibrance: -0.5 })
})
