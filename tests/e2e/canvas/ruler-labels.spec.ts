import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Figma desktop (2026-11-09) labels a selection's edges on the rulers to three decimals at any
// zoom: 100.375 and 251.631 across, 80.125 and 113.458 down for this layer.
const editor = useEditorSetupWithClear('/?test&no-chrome')

test('a fractional selection’s ruler labels show three decimals', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const layer = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      x: 100.375,
      y: 80.125,
      width: 151.256,
      height: 33.333333,
      fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8, a: 1 }, visible: true, opacity: 1 }]
    })
    store.state.zoom = 2
    store.state.panX = 0
    store.state.panY = 0
    store.select([layer.id])
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot('fractional-selection-rulers.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })
})
