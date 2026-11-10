import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'

import { renderFromEditorState } from '#core/canvas/renderer/pipeline'
import { createDefaultEditorState } from '#core/editor'
import type { LayerEdits } from '#core/editor/views/types'

const SIZE = 64
const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
afterAll(() => renderer.destroy())

const BLACK = { r: 0, g: 0, b: 0, a: 1 }

/**
 * The pixel just outside the top-left corner of the selection, on a black page: a corner handle
 * paints it white, and without one it stays the page's black.
 */
function cornerPixel(layers: number, levels: { layerEdits?: LayerEdits; readOnly?: boolean }) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const ids = Array.from({ length: layers }, (_, i) =>
    graph.createNode('RECTANGLE', page.id, {
      x: 16 + i * 12,
      y: 16 + i * 12,
      width: 20,
      height: 20,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    }).id
  )
  const state = createDefaultEditorState(page.id)
  state.pageColor = BLACK
  state.zoom = 1
  state.panX = 0
  state.panY = 0
  state.selectedIds = new Set(ids)
  state.hostRestrictions = { ...state.hostRestrictions, ...levels }
  renderFromEditorState(renderer, state, graph, null, SIZE, SIZE, false)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = expectDefined(
      image.readPixels(14, 14, {
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

const WHITE_PIXEL = [255, 255, 255]
const BLACK_PIXEL = [0, 0, 0]

// The canvas draws the handles its input takes: none where the host lets layers only move or not
// change, as a read-only document shows none, for one layer and for a multi-selection's bounds.
describe.each([1, 2])('a selection of %i layer(s)', (layers) => {
  test('shows handles while layers take every edit', () => {
    expect(cornerPixel(layers, {})).toEqual(WHITE_PIXEL)
  })

  test.each(['move', 'none'] as const)('shows none while layers take layerEdits %s', (layerEdits) => {
    expect(cornerPixel(layers, { layerEdits })).toEqual(BLACK_PIXEL)
  })

  test('shows none in a read-only document', () => {
    expect(cornerPixel(layers, { readOnly: true })).toEqual(BLACK_PIXEL)
  })
})
