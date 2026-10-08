import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { SkiaRenderer } from '@open-pencil/core'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { materializeDocument } from '@open-pencil/fig'

import { expectDefined } from '../helpers/assert'
import { absoluteConstraintRecords } from '../helpers/fig/absolute-constraints'
import { FIXTURES } from '../helpers/fig/fixtures'

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
      await Bun.file(resolve(FIXTURES, 'absolute-constraint-figma.png')).arrayBuffer()
    )
    expect(decode(png)).toEqual(decode(native))
  } finally {
    renderer.destroy()
  }
})
