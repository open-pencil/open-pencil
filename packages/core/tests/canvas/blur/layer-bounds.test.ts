import { afterAll, describe, expect, test } from 'bun:test'

import { effect, solid } from '#core-tests/canvas/blur/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

describe('a layer blur bounded to the viewport', () => {
  /** Ink of a turned frame whose child lies along a 60px viewport strip once turned. */
  function directInk(boundToViewport: boolean): number {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const parent = graph.createNode('FRAME', page, {
      x: 200,
      y: 10,
      width: 40,
      height: 40,
      rotation: 90,
      fills: [],
      clipsContent: false,
      effects: [effect('LAYER_BLUR', 1)]
    })
    graph.createNode('RECTANGLE', parent.id, {
      y: 60,
      width: 40,
      height: 100,
      fills: [solid(0, 0, 1)]
    })
    const surface = expectDefined(ck.MakeSurface(400, 400))
    const previous = {
      bound: renderer.boundEffectLayersToViewport,
      viewport: renderer.worldViewport
    }
    renderer.boundEffectLayersToViewport = boundToViewport
    renderer.worldViewport = { x: 0, y: 0, w: 400, h: 60 }
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.TRANSPARENT)
      renderer.renderNode(canvas, graph, parent.id, {})
      surface.flush()
      const pixels = expectDefined(
        canvas.readPixels(0, 0, {
          width: 400,
          height: 400,
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      let area = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 127) {
          area++
        }
      }
      return area
    } finally {
      renderer.boundEffectLayersToViewport = previous.bound
      renderer.worldViewport = previous.viewport
      surface.delete()
    }
  }

  test('keeps a turned node with a child past its box', () => {
    const unbounded = directInk(false)
    expect(unbounded).toBeGreaterThan(40 * 100 * 0.9)
    expect(Math.abs(directInk(true) - unbounded)).toBeLessThanOrEqual(unbounded * 0.05)
  })
})

describe('layer bounds after the graph changes', () => {
  const CANVAS = 400

  /** Pixels a blurred frame's subtree inks at more than half alpha. */
  function inkedPixels(
    graph: SceneGraph,
    frameId: string,
    overlays: Parameters<SkiaRenderer['renderNode']>[3] = {}
  ): number {
    const surface = expectDefined(ck.MakeSurface(CANVAS, CANVAS))
    const previousViewport = renderer.worldViewport
    renderer.worldViewport = { x: 0, y: 0, w: CANVAS, h: CANVAS }
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.TRANSPARENT)
      renderer.renderNode(canvas, graph, frameId, overlays)
      surface.flush()
      const pixels = expectDefined(
        canvas.readPixels(0, 0, {
          width: CANVAS,
          height: CANVAS,
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      let inked = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 128) {
          inked++
        }
      }
      return inked
    } finally {
      renderer.worldViewport = previousViewport
      surface.delete()
    }
  }

  test('follow a child moved, resized, previewed, turned, and given a child', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, {
      x: 50,
      y: 50,
      width: 20,
      height: 20,
      fills: [],
      clipsContent: false,
      effects: [effect('LAYER_BLUR', 1)]
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      width: 20,
      height: 20,
      fills: [solid(0, 0, 1)]
    })
    const square = inkedPixels(graph, frame.id)
    expect(square).toBeGreaterThan(0)

    graph.updateNode(child.id, { x: 100 })
    expect(inkedPixels(graph, frame.id)).toBeGreaterThan(square * 0.9)

    graph.updateNode(child.id, { width: 100 })
    const bar = inkedPixels(graph, frame.id)
    expect(bar).toBeGreaterThan(square * 4)

    graph.updateNodePreview(child.id, { x: 200 })
    expect(inkedPixels(graph, frame.id)).toBeGreaterThan(bar * 0.9)

    const turned = (angle: number) =>
      inkedPixels(graph, frame.id, { rotationPreview: { nodeId: child.id, angle } })
    expect(turned(90)).toBeGreaterThan(bar * 0.9)
    expect(turned(90)).toBeGreaterThan(bar * 0.9)
    expect(turned(45)).toBeGreaterThan(bar * 0.9)

    graph.createNode('RECTANGLE', child.id, { width: 0, height: 0, fills: [solid(0, 0, 1)] })
    graph.updateNode(child.id, { x: -40 })
    expect(inkedPixels(graph, frame.id)).toBeGreaterThan(bar * 0.9)
  })
})
