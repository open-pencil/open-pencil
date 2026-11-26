import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import {
  dismissWideGamutBanner,
  focusWideGamutScene,
  sceneBufferState,
  showWideGamutScene
} from '#tests/helpers/canvas/color-space/driver'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

for (const colorSpace of ['srgb', 'display-p3'] as const) {
  test(`sRGB bitmap colors survive a ${colorSpace} document on an sRGB display`, async ({
    page
  }) => {
    await page.goto('/?test&no-chrome&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await canvas.clearCanvas()
    test.skip(
      await page.evaluate(() => matchMedia('(color-gamut: p3)').matches),
      'Requires an sRGB display'
    )
    const samples = [
      [248, 130, 29],
      [17, 181, 143],
      [65, 117, 235]
    ]
    await page.evaluate(
      async ({ colorSpace, samples }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        store.setDocumentColorSpace(colorSpace)
        const source = document.createElement('canvas')
        source.width = 96
        source.height = 32
        const context = source.getContext('2d', { colorSpace: 'srgb' })
        if (!context) throw new Error('sRGB canvas unavailable')
        const data = context.createImageData(source.width, source.height)
        for (let pixel = 0; pixel < source.width * source.height; pixel++) {
          const rgb = samples[Math.floor((pixel % source.width) / 32)]
          data.data.set([...rgb, 255], pixel * 4)
        }
        context.putImageData(data, 0, 0)
        const blob = await new Promise<Blob>((resolve, reject) => {
          source.toBlob((value) => {
            if (value) resolve(value)
            else reject(new Error('Cannot encode bitmap'))
          })
        })
        const imageHash = store.storeImage(new Uint8Array(await blob.arrayBuffer()))
        store.graph.createNode('RECTANGLE', store.state.currentPageId, {
          x: 40,
          y: 40,
          width: 96,
          height: 32,
          fills: [
            {
              type: 'IMAGE',
              imageHash,
              imageScaleMode: 'FIT',
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1,
              visible: true
            }
          ]
        })
        store.requestRender()
      },
      { colorSpace, samples }
    )
    await canvas.waitForRender()
    const shown = await readScenePixels(
      page,
      samples.map((_, index) => ({ x: 56 + index * 32, y: 56 }))
    )
    // A P3 document is drawn in 8-bit P3, as Figma draws it, so its sRGB bitmap comes back to the
    // sRGB screen through P3 and may round a level either way.
    const tolerance = colorSpace === 'srgb' ? 0 : 1
    for (const [index, rgb] of samples.entries()) {
      for (const [channel, value] of rgb.entries()) {
        expect(Math.abs(shown[index][channel] - value)).toBeLessThanOrEqual(tolerance)
      }
      expect(shown[index][3]).toBe(255)
    }
    canvas.assertNoErrors()
  })
}

test.describe('a Display P3 document on an sRGB display', () => {
  test.use({ viewport: { width: 1200, height: 900 } })

  test('draws text, gradients, shadows, noise, texture, and blends in its profile', async ({
    page
  }) => {
    await page.goto('/?test&no-chrome&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    test.skip(
      await page.evaluate(() => matchMedia('(color-gamut: p3)').matches),
      'Requires an sRGB display'
    )
    const frameId = await showWideGamutScene(page, 'createP3RenderingScene')
    await dismissWideGamutBanner(page)
    await focusWideGamutScene(page, frameId)
    expect(await sceneBufferState(page)).toEqual({
      colorSpace: 'srgb',
      documentColorSpace: 'display-p3',
      error: 0
    })
    expect(await canvas.screenshotCanvas()).toMatchSnapshot('p3-rendering.png', {
      maxDiffPixelRatio: 0,
      threshold: 0
    })
    canvas.assertNoErrors()
  })
})
