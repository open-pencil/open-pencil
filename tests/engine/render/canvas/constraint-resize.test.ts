import { expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { materializeDocument } from '@open-pencil/fig'

import { expectDefined } from '#tests/helpers/assert'
import { absoluteConstraintRecords } from '#tests/helpers/fig/absolute-constraints'

test('absolute resize constraints match native Figma pixels', async () => {
  const { graph, sources } = materializeDocument(absoluteConstraintRecords())
  const ck = await initCanvasKit()
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
  const root = expectDefined(sources.get('1:4'))
  const decode = (bytes: Uint8Array) => {
    const image = expectDefined(ck.MakeImageFromEncoded(bytes))
    try {
      expect([image.width(), image.height()]).toEqual([200, 120])
      return image.readPixels(0, 0, {
        width: 200,
        height: 120,
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    } finally {
      image.delete()
    }
  }
  try {
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [root], {
        scale: 1,
        format: 'PNG',
        trimTransparent: false
      })
    )
    const native = new Uint8Array(
      await Bun.file(
        new URL('../../../fixtures/absolute-constraint-figma.png', import.meta.url)
      ).arrayBuffer()
    )
    expect(decode(png)).toEqual(decode(native))
  } finally {
    renderer.destroy()
  }
})
