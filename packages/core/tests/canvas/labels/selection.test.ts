import { afterAll, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'

import { renderFromEditorState } from '#core/canvas/renderer/pipeline'
import { BLACK, SIZE_PILL_HEIGHT, SIZE_PILL_PADDING_Y } from '#core/constants'
import { createDefaultEditorState } from '#core/editor'

const SIZE = 96
const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
// The pill is drawn whatever the typeface, so the default one stands in for the loaded font.
renderer.chromeFonts.label = new ck.Font(null, 11)
renderer.chromeFonts.size = new ck.Font(null, 11)
afterAll(() => renderer.destroy())

const GREEN_THEME = { color: { r: 0, g: 1, b: 0, a: 1 }, foreground: BLACK }
const LAYER = { x: 24, y: 16, width: 48, height: 32 }

/** The pixel in the middle of where the size pill sits under one selected layer, on a black page. */
function pillPixel(showSizeLabels?: boolean) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const { id } = graph.createNode('RECTANGLE', page.id, LAYER)
  const state = createDefaultEditorState(page.id)
  state.pageColor = BLACK
  state.zoom = 1
  state.panX = 0
  state.panY = 0
  state.selectedIds = new Set([id])
  state.selectionTheme = GREEN_THEME
  state.showSizeLabels = showSizeLabels
  renderFromEditorState(renderer, state, graph, null, SIZE, SIZE, false)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const x = LAYER.x + LAYER.width / 2
    const y = LAYER.y + LAYER.height + SIZE_PILL_PADDING_Y + SIZE_PILL_HEIGHT / 2
    const pixels = expectDefined(
      image.readPixels(x, y, {
        width: 1,
        height: 1,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    return Array.from(pixels.subarray(0, 3))
  } finally {
    image.delete()
  }
}

test('a selection shows its size under it in the selection colour', () => {
  expect(pillPixel()).toEqual([0, 255, 0])
  expect(pillPixel(true)).toEqual([0, 255, 0])
})

test('a host that turns size labels off gets none', () => {
  expect(pillPixel(false)).toEqual([0, 0, 0])
})
