import type { CanvasKit, Surface } from '@open-pencil/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas'
import { TiledSceneController, type TiledSceneFrameResult } from '#core/canvas/renderer/tiles'

/** An opaque solid fill list of one colour. */
export function color(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

/**
 * Four rows of twelve 80px squares 100px apart, and an idle renderer over a 1280 × 800 viewport
 * at zoom 1 and DPR 1 showing them on a white page.
 */
export function createGridScene(ck: CanvasKit) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  for (let index = 0; index < 48; index++) {
    graph.createNode('RECTANGLE', page.id, {
      x: (index % 12) * 100,
      y: Math.floor(index / 12) * 100,
      width: 80,
      height: 80,
      fills: color(0.2, 0.4, 0.8)
    })
  }
  const surface = expectDefined(ck.MakeSurface(1280, 800), 'scheduling surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.pageId = page.id
  renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
  renderer.viewportWidth = 1280
  renderer.viewportHeight = 800
  renderer.dpr = 1
  renderer.zoom = 1
  renderer.navigationPhase = 'idle'
  return { graph, surface, renderer, pageId: page.id }
}

/** The red, green, blue, and alpha of the surface's pixel at `x`, `y`, after a flush. */
export function pixelAt(ck: CanvasKit, surface: Surface, x: number, y: number): number[] {
  surface.flush()
  const image = surface.makeImageSnapshot()
  const pixels = expectDefined(
    image.readPixels(x, y, {
      width: 1,
      height: 1,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    }),
    'pixel'
  )
  image.delete()
  return Array.from(pixels as Uint8Array)
}

/** What a frame of the tiled scene draws from: it draws onto the renderer's surface. */
export interface TileFrameInputs {
  renderer: SkiaRenderer
  graph: SceneGraph
}

/** Whether a frame left visible tiles outstanding. */
export function isPending(result: TiledSceneFrameResult): boolean {
  return result.pending
}

/** Whether a frame left visible tiles or background stages outstanding. */
export function isUnsettled(result: TiledSceneFrameResult): boolean {
  return result.pending || result.backgroundPending
}

/**
 * Renders a frame at the given generations, then up to `frames` more while `again` holds for
 * the last, and returns the last frame's result.
 */
export function renderFramesWhile(
  controller: TiledSceneController,
  { renderer, graph }: TileFrameInputs,
  frames: number,
  again: (result: TiledSceneFrameResult) => boolean,
  contentGeneration = 1,
  navigationGeneration = 0
): TiledSceneFrameResult {
  const render = () =>
    controller.renderFrame(
      renderer,
      renderer.surface.getCanvas(),
      graph,
      contentGeneration,
      navigationGeneration
    )
  let result = render()
  for (let frame = 0; frame < frames && again(result); frame++) result = render()
  return result
}

/** Renders frames until the visible tiles and the background stages are done, 30 at most. */
export function renderUntilSettled(
  controller: TiledSceneController,
  inputs: TileFrameInputs
): TiledSceneFrameResult {
  return renderFramesWhile(controller, inputs, 30, isUnsettled)
}

/** A clock that advances by `step` at every reading, starting still. */
export function steppedClock(): { step: number; now: () => number } {
  let time = 0
  const clock = { step: 0, now: () => (time += clock.step) }
  return clock
}

/** A controller on a clock that never advances: every tile is free, so only the cost model can stop a frame. */
export function stillController(): TiledSceneController {
  return new TiledSceneController({ now: () => 0 })
}
