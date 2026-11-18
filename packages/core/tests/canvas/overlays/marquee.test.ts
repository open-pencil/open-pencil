import { afterAll, describe, expect, test } from 'bun:test'

import { expectRgbaPixels } from '#core-tests/canvas/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { renderFromEditorState } from '#core/canvas/renderer/pipeline'
import { createDefaultEditorState } from '#core/editor'

const SIZE = 64
const ZOOM = 0.05
// Half a pixel in, so the marquee's left edge falls on one whole pixel column.
const PAN = 0.5
// A screen row that crosses the marquee's left edge above the caught layers, and how far along
// it to look: past the left edge, short of the layers and the right edge.
const ROW = 12
const SPAN = 20

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
afterAll(() => renderer.destroy())

/**
 * The marquee's border width in screen pixels, measured along `ROW` on a black page while
 * `layers` layers are selected, at 5% zoom: the opaque selection blue, against the marquee's
 * faint fill on one side and the page on the other.
 */
function marqueeBorderWidth(layers: number): number {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const ids = Array.from(
    { length: layers },
    (_, i) =>
      graph.createNode('RECTANGLE', page.id, {
        x: 500 + i * 200,
        y: 500,
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      }).id
  )
  const state = createDefaultEditorState(page.id)
  state.pageColor = { r: 0, g: 0, b: 0, a: 1 }
  state.zoom = ZOOM
  state.panX = PAN
  state.panY = PAN
  state.selectedIds = new Set(ids)
  state.marquee = { x: 200, y: 100, width: 800, height: 800 }
  renderFromEditorState(renderer, state, graph, null, SIZE, SIZE, false)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = expectRgbaPixels(
      image.readPixels(0, ROW, {
        width: SPAN,
        height: 1,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    return Array.from({ length: SPAN }, (_, x) => pixels[x * 4 + 2]).filter((blue) => blue > 128)
      .length
  } finally {
    image.delete()
  }
}

// Figma strokes the marquee one screen pixel wide at every zoom. A single selection draws its
// outline in world units, 1/zoom wide; that width must not reach the marquee drawn after it.
describe.each([1, 2])('with %i layer(s) selected', (layers) => {
  test('the marquee border is one screen pixel at 5% zoom', () => {
    expect(marqueeBorderWidth(layers)).toBe(1)
  })
})
