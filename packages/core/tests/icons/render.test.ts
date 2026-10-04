import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { createIconFromPaths } from '#core/icons/render'
import { buildIconData } from '#core/icons/svg'

const BLACK = parseColor('#000000')

function insertIcon(graph: SceneGraph, body: string, viewBox = 24, size = 24) {
  const icon = buildIconData({ body }, 'test', 'icon', viewBox, viewBox, size)
  const page = graph.getPages()[0]
  const frame = createIconFromPaths(graph, icon, 'test:icon', size, BLACK, page.id)
  return { page, frame, vectors: graph.getChildren(frame.id) }
}

describe('createIconFromPaths', () => {
  test('fills open subpaths of a filled path together with its closed subpaths', async () => {
    const graph = new SceneGraph()
    // An open outer square around a closed, counter-wound inner square: a 24 px ring.
    const { page, frame } = insertIcon(
      graph,
      '<path fill="currentColor" d="M0 0h24v24H0M6 6v12h12V6z"/>'
    )

    const ck = await initCanvasKit()
    const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [frame.id], {
          scale: 1,
          format: 'PNG',
          trimTransparent: false
        })
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png))
      const alphaAt = (x: number, y: number) => {
        const pixel = expectDefined(
          image.readPixels(x, y, {
            width: 1,
            height: 1,
            alphaType: ck.AlphaType.Unpremul,
            colorType: ck.ColorType.RGBA_8888,
            colorSpace: ck.ColorSpace.SRGB
          })
        )
        return pixel[3]
      }
      try {
        expect(alphaAt(3, 3)).toBe(255)
        expect(alphaAt(12, 12)).toBe(0)
      } finally {
        image.delete()
      }
    } finally {
      renderer.destroy()
    }
  })
})
