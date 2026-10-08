import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { createImagePreviewScene, imagePreviewState } from '#tests/helpers/canvas/image-previews'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('large-document previews preserve image fill modes and strokes across zoom', async () => {
  await createImagePreviewScene(editor.page)
  await expect
    .poll(async () => {
      const state = await imagePreviewState(editor.page)
      return state.enabled && state.idle && state.keys.some((key) => key.endsWith(':preview:256'))
    })
    .toBe(true)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'viewport-image-previews.png'
  )
  await editor.canvas.hover(200, 150)
  await editor.page.keyboard.down('Control')
  try {
    await editor.page.mouse.wheel(0, -10)
  } finally {
    await editor.page.keyboard.up('Control')
  }
  await expect
    .poll(async () =>
      (await imagePreviewState(editor.page)).keys.some((key) => key.endsWith(':preview:512'))
    )
    .toBe(true)
  const state = await imagePreviewState(editor.page)
  expect(state.weight).toBeLessThanOrEqual(128 * 1024 * 1024)
  expect(state.originals).toBe(129)
  editor.canvas.assertNoErrors()
})
