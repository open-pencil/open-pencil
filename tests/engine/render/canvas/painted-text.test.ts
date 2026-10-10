import { beforeAll, expect, test } from 'bun:test'

import type { Fill } from '@open-pencil/scene-graph'
import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas/renderer'
import { withTextParagraph, type TextLayout } from '#core/canvas/text'
import { fontManager } from '#core/text/fonts'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

const FONT_FAMILY = 'Painted text fixture'
beforeAll(async () => {
  for (const style of ['Regular', 'SemiBold']) {
    const data = await Bun.file(repoPath(`packages/core/assets/Inter-${style}.ttf`)).arrayBuffer()
    fontManager.markLoaded(FONT_FAMILY, style, data)
  }
})

const solid: Fill = { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
const gradient: Fill = {
  ...solid,
  type: 'GRADIENT_LINEAR',
  gradientStops: [
    { position: 0, color: solid.color },
    { position: 1, color: solid.color }
  ],
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
}

test('mutable foreground paints never enter the paragraph cache, including on errors', async () => {
  const ck = await initCanvasKit()
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(100, 100), 'surface'))
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const node = graph.createNode('TEXT', page.id, {
    text: 'Paint',
    fontFamily: FONT_FAMILY,
    width: 100,
    height: 100
  })
  let borrowed: TextLayout | undefined
  try {
    await renderer.loadFonts()
    expect(() =>
      withTextParagraph(
        renderer,
        node,
        ck.BLACK,
        { halfLeading: true, foregroundPaint: renderer.fillPaint },
        (paragraph) => {
          borrowed = paragraph
          throw new Error('paint failed')
        }
      )
    ).toThrow('paint failed')
    expect(borrowed?.isDeleted()).toBe(true)
  } finally {
    renderer.destroy()
  }
})

for (const textAlignVertical of ['TOP', 'CENTER', 'BOTTOM'] as const) {
  for (const fixture of [
    { text: 'OPEN', fontSize: 88, width: 560, height: 96 },
    { text: 'office AV\nOPEN', fontSize: 32, width: 130, height: 180 },
    {
      text: 'Bold AV\noffice',
      fontSize: 32,
      width: 130,
      height: 180,
      styleRuns: [{ start: 0, length: 4, style: { fontSize: 40, fontWeight: 600 } }]
    }
  ]) {
    test(`complex paint preserves paragraph coverage: ${textAlignVertical} ${fixture.text}`, async () => {
      const ck = await initCanvasKit()
      const graph = new SceneGraph()
      const page = expectDefined(graph.getPages()[0], 'page')
      const node = graph.createNode('TEXT', page.id, {
        ...fixture,
        fontFamily: FONT_FAMILY,
        fontWeight: 400,
        textAlignVertical,
        textAutoResize: 'NONE',
        fills: [solid]
      })
      const surface = expectDefined(ck.MakeSurface(fixture.width, fixture.height), 'surface')
      const renderer = new SkiaRenderer(ck, surface)
      try {
        await renderer.loadFonts()
        expect(renderer.nodeFontReadiness(node)).toBe('ready')
        const draw = (fill: Fill) => {
          graph.updateNode(node.id, { fills: [fill] })
          const canvas = surface.getCanvas()
          canvas.clear(ck.WHITE)
          renderer.renderShape(canvas, node, graph)
          surface.flush()
          const image = surface.makeImageSnapshot()
          try {
            const pixels = image.readPixels(0, 0, {
              width: fixture.width,
              height: fixture.height,
              colorType: ck.ColorType.RGBA_8888,
              alphaType: ck.AlphaType.Unpremul,
              colorSpace: ck.ColorSpace.SRGB
            })
            if (!(pixels instanceof Uint8Array)) throw new Error('RGBA bytes unavailable')
            return pixels.slice()
          } finally {
            image.delete()
          }
        }
        const reference = draw(solid)
        expect(reference.some((value, index) => index % 4 !== 3 && value < 128)).toBe(true)
        expect(draw(gradient)).toEqual(reference)
      } finally {
        renderer.destroy()
      }
    })
  }
}
