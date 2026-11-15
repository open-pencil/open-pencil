import { expect } from 'bun:test'

import { unpremultipliedPixels } from '#core-tests/helpers/figma-rows'

import type { Image } from '@open-pencil/canvaskit'
import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Effect } from '@open-pencil/scene-graph'
import { maxOf } from '@open-pencil/scene-graph/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()

/**
 * A row of pixels across the left edge of a 200px square at x = 100, from x = 60 to 140, in a
 * 400px frame, read from Figma 126 exports: alpha for layer blur and drop shadow, red for inner
 * shadow on white and for background blur over a black-to-white edge.
 */
export const FIGMA: Record<string, number[]> = {
  'LAYER_BLUR 4': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 3, 19, 51, 99, 157, 204, 237, 252, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255
  ],
  'LAYER_BLUR 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 4, 6, 10, 15, 21,
    28, 36, 46, 55, 66, 77, 91, 105, 120, 135, 150, 164, 177, 188, 200, 210, 219, 227, 234, 240,
    245, 249, 252, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
  ],
  'DROP_SHADOW 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 4, 6, 10, 15, 21,
    28, 36, 46, 55, 66, 77, 91, 105, 120, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
  ],
  'INNER_SHADOW 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 135, 151, 164, 178, 190, 201, 211, 220, 227, 235, 239, 245, 249, 252,
    254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255
  ],
  'BACKGROUND_BLUR 16': [
    3, 4, 4, 4, 3, 4, 3, 4, 4, 3, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 7, 9, 12, 18, 23,
    31, 39, 48, 58, 69, 80, 94, 107, 122, 137, 152, 166, 179, 190, 202, 210, 219, 227, 234, 241,
    245, 249, 252, 254, 254, 255, 255, 254, 255, 255, 255, 254, 255, 254, 254, 254, 255, 255, 255,
    254, 255, 255, 255, 255, 255, 255, 255, 254, 254, 255
  ],
  'BACKGROUND_BLUR 16 union': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 198, 190, 202, 210, 219, 227, 234, 241, 245, 249, 252,
    254, 254, 255, 255, 254, 255, 255, 255, 254, 255, 254, 254, 254, 255, 255, 255, 254, 255, 255,
    255, 255, 255, 255, 255, 254, 254, 255
  ]
}

export const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})

export function effect(type: Effect['type'], radius: number): Effect {
  return {
    type,
    radius,
    spread: 0,
    offset: { x: 0, y: 0 },
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
}

export function expectFigmaEdge(row: number[], figma: number[], from = 60) {
  const differences = row.flatMap((value, index) =>
    60 + index < from ? [] : [Math.abs(value - figma[index])]
  )
  const rms = Math.sqrt(differences.reduce((sum, d) => sum + d * d, 0) / differences.length)
  expect(maxOf(differences)).toBeLessThanOrEqual(6)
  expect(rms).toBeLessThanOrEqual(2)
}

type SceneBuild = (graph: SceneGraph, frameId: string) => void

export function pixelProbes(renderer: SkiaRenderer) {
  function renderFrame<T>(build: SceneBuild, read: (image: Image) => T): T {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, {
      width: 400,
      height: 400,
      fills: [],
      clipsContent: false
    })
    build(graph, frame.id)
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page, [frame.id], {
        scale: 1,
        format: 'PNG',
        trimTransparent: false
      })
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png))
    try {
      return read(image)
    } finally {
      image.delete()
    }
  }

  function edgeRow(build: SceneBuild, channel: 0 | 3): number[] {
    return renderFrame(build, (image) => {
      const offset = (image.width() - 400) / 2
      const pixels = unpremultipliedPixels(ck, image)
      const row: number[] = []
      for (let x = 60; x <= 140; x++) {
        row.push(pixels[((200 + offset) * image.width() + x + offset) * 4 + channel])
      }
      return row
    })
  }

  /** How many pixels of a 400px frame `build` fills draw anything into. */
  function inkArea(build: SceneBuild): number {
    return renderFrame(build, (image) => {
      const pixels = unpremultipliedPixels(ck, image)
      let area = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 127) {
          area++
        }
      }
      return area
    })
  }

  return { edgeRow, inkArea }
}
