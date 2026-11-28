import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { blendDriver } from '#tests/helpers/canvas/blend/driver'
import { PASS_THROUGH_SWATCHES, SOFT_LIGHT_SWATCHES } from '#tests/helpers/canvas/blend/scene'
import { showView, waitForSettledScene } from '#tests/helpers/canvas/page-scene'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = blendDriver(() => editor.page)

test('plus darker and plus lighter on layers, fills and strokes', async () => {
  await scene.showLinear()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'plus-darker-plus-lighter.png'
  )
})

test('soft light as Figma draws it', async () => {
  await showView(editor.page, { zoom: 1, panX: 0, panY: 0 })
  const centres = await scene.showSoftLight()
  await waitForSettledScene(editor.page)
  editor.canvas.assertNoErrors()

  const pixels = await readScenePixels(editor.page, centres)
  for (const [index, { figma }] of SOFT_LIGHT_SWATCHES.entries())
    for (const [channel, value] of figma.entries())
      expect(Math.abs(pixels[index][channel] - value)).toBeLessThanOrEqual(1)
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('soft-light.png')
})

test('pass-through frames with opacity blend their layers with what is under them', async () => {
  await showView(editor.page, { zoom: 1, panX: 0, panY: 0 })
  const centres = await scene.showPassThrough()
  await waitForSettledScene(editor.page)
  editor.canvas.assertNoErrors()

  const pixels = await readScenePixels(editor.page, centres)
  for (const [index, { figma }] of PASS_THROUGH_SWATCHES.entries()) {
    expect(Math.abs(pixels[index][0] - figma)).toBeLessThanOrEqual(1)
  }
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('pass-through.png')
})
