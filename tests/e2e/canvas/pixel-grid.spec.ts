import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { pixelGridDriver } from '#tests/helpers/canvas/pixel-grid-driver'

// Figma desktop 126: the pixel grid shows once a document pixel covers 8 device pixels (800% at
// 1×, 400% at 2×), Shift+' toggles it, and
// Shift+⌘' toggles snapping to it.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const grid = pixelGridDriver(() => editor.page)

async function zoomTo(zoom: number) {
  await grid.showAtZoom(zoom)
  await editor.canvas.waitForRender()
}

test('the pixel grid shows when zoomed in and Shift+quote toggles it', async () => {
  await zoomTo(8)
  const shown = await editor.canvas.screenshotCanvasRegion(480, 320)
  expect(shown).toMatchSnapshot('pixel-grid-800.png', { maxDiffPixelRatio: 0, threshold: 0 })

  await editor.page.keyboard.press('Shift+Quote')
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(480, 320)).not.toEqual(shown)

  await editor.page.keyboard.press('Shift+Quote')
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(480, 320)).toEqual(shown)
  editor.canvas.assertNoErrors()
})

test('just below 8 device pixels per document pixel the canvas has no grid', async () => {
  const dpr = await grid.devicePixelRatio()
  await zoomTo(8 / dpr - 0.1)
  const before = await editor.canvas.screenshotCanvasRegion(480, 320)
  await editor.page.keyboard.press('Shift+Quote')
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(480, 320)).toEqual(before)
  await editor.page.keyboard.press('Shift+Quote')
})

test('Shift+Cmd+quote toggles snapping to the pixel grid', async () => {
  await zoomTo(1)
  expect(await grid.snapsToPixelGrid()).toBe(true)
  await editor.page.keyboard.press('ControlOrMeta+Shift+Quote')
  await expect.poll(() => grid.snapsToPixelGrid()).toBe(false)
  await editor.page.keyboard.press('ControlOrMeta+Shift+Quote')
  await expect.poll(() => grid.snapsToPixelGrid()).toBe(true)
})
