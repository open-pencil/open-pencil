import { afterAll, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { LayerFrame } from '@open-pencil/scene-graph/slides'
import { expectDefined } from '@open-pencil/test-support/assert'

import { renderFromEditorState } from '#core/canvas/renderer/pipeline'
import { BLACK } from '#core/constants'
import { createDefaultEditorState } from '#core/editor'

const SIZE = 96
const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
afterAll(() => renderer.destroy())

const graph = new SceneGraph()
const page = expectDefined(graph.getPages()[0], 'page')
const { id } = graph.createNode('RECTANGLE', page.id, {
  x: 8,
  y: 8,
  width: 24,
  height: 24,
  fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
})

/** The editor canvas's pixels at `points`, with the layer at `frame` of a build preview, or at rest. */
function pixels(frame: LayerFrame | null, points: [number, number][]) {
  const state = createDefaultEditorState(page.id)
  state.pageColor = BLACK
  state.zoom = 1
  state.panX = 0
  state.panY = 0
  state.buildPreview = frame
    ? { slideId: page.id, layers: new Map([[id, frame]]), animatingId: id }
    : null
  renderFromEditorState(renderer, state, graph, null, SIZE, SIZE, false)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    return points.map(([x, y]) =>
      Array.from(
        expectDefined(
          image.readPixels(x, y, {
            width: 1,
            height: 1,
            colorType: ck.ColorType.RGBA_8888,
            alphaType: ck.AlphaType.Unpremul,
            colorSpace: ck.ColorSpace.SRGB
          }),
          'pixels'
        ).subarray(0, 3)
      )
    )
  } finally {
    image.delete()
  }
}

const RED = [255, 0, 0]
const PAGE = [0, 0, 0]

test('a build preview draws its layers where they are in the step, not the recorded scene', () => {
  const home: [number, number] = [20, 20]
  const moved: [number, number] = [60, 20]
  // Drawn at rest first, so the canvas has the scene recorded.
  expect(pixels(null, [home, moved])).toEqual([RED, PAGE])
  expect(pixels({ x: 0, y: 0, opacity: 0 }, [home, moved])).toEqual([PAGE, PAGE])
  expect(pixels({ x: 40, y: 0, opacity: 1 }, [home, moved])).toEqual([PAGE, RED])
  expect(pixels(null, [home, moved])).toEqual([RED, PAGE])
})
