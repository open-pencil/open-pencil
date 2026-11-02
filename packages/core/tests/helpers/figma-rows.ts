import { expect } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from './assert'

/** Builds a scene into the frame `hostId`. */
export type FigmaRowScene = (graph: SceneGraph, hostId: string) => void

/**
 * Renders `build` into a 400 × 300 frame without a fill, the size of the Figma 126 exports the
 * rows are read from, and reads every 2px from `x0` to `x1` at `y`: alpha unless `channel` says.
 */
export function renderRow(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  build: FigmaRowScene,
  y: number,
  x0: number,
  x1: number,
  channel = 3
): number[] {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const host = graph.createNode('FRAME', page, {
    width: 400,
    height: 300,
    fills: [],
    clipsContent: true
  })
  build(graph, host.id)
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [host.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const offset = (image.width() - 400) / 2
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: image.width(),
        height: image.height(),
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    const values: number[] = []
    for (let x = x0; x <= x1; x += 2) {
      values.push(pixels[((y + offset) * image.width() + x + offset) * 4 + channel])
    }
    return values
  } finally {
    image.delete()
  }
}

/** Our blur kernel is fitted to Figma's within a few levels; outlines must match exactly. */
export function expectFigmaRow(values: number[], figma: number[]): void {
  expect(values).toHaveLength(figma.length)
  const differences = values.map((value, index) => Math.abs(value - figma[index]))
  const rms = Math.sqrt(differences.reduce((sum, d) => sum + d * d, 0) / differences.length)
  expect(Math.max(...differences)).toBeLessThanOrEqual(10)
  expect(rms).toBeLessThanOrEqual(3)
}
