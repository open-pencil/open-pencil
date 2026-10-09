import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Figma desktop 126: the pixel grid shows once a document pixel covers 8 device pixels (800% at
// 1×, 400% at 2×), Shift+' toggles it, and
// Shift+⌘' toggles snapping to it.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function zoomTo(zoom: number) {
  await editor.page.evaluate((zoom) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Probe',
      x: 0,
      y: 0,
      width: 40,
      height: 30,
      fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.state.zoom = zoom
    store.state.panX = 40
    store.state.panY = 40
    store.clearSelection()
    store.requestRender()
  }, zoom)
  await editor.canvas.waitForRender()
}

function snapping() {
  return editor.page.evaluate(() => window.openPencil?.getStore?.().state.snappingPreferences)
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
  const dpr = await editor.page.evaluate(() => devicePixelRatio)
  await zoomTo(8 / dpr - 0.1)
  const grid = await editor.canvas.screenshotCanvasRegion(480, 320)
  await editor.page.keyboard.press('Shift+Quote')
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(480, 320)).toEqual(grid)
  await editor.page.keyboard.press('Shift+Quote')
})

test('Shift+Cmd+quote toggles snapping to the pixel grid', async () => {
  await zoomTo(1)
  expect((await snapping())?.pixelGrid).toBe(true)
  await editor.page.keyboard.press('ControlOrMeta+Shift+Quote')
  await expect.poll(async () => (await snapping())?.pixelGrid).toBe(false)
  await editor.page.keyboard.press('ControlOrMeta+Shift+Quote')
  await expect.poll(async () => (await snapping())?.pixelGrid).toBe(true)
})
