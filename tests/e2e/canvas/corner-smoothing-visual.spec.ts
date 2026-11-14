import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('regular partial full and independent corner smoothing', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const smoothingValues = [0, 0.5, 1]
    for (const [index, cornerSmoothing] of smoothingValues.entries()) {
      store.graph.createNode('RECTANGLE', pageId, {
        name: `Corner smoothing ${cornerSmoothing}`,
        x: 70 + index * 180,
        y: 90,
        width: 140,
        height: 120,
        cornerRadius: 42,
        cornerSmoothing,
        fills: [
          {
            type: 'SOLID',
            color: { r: 0.23, g: 0.51, b: 0.96, a: 1 },
            visible: true,
            opacity: 1
          }
        ]
      })
    }

    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Independent smoothed corners',
      x: 610,
      y: 90,
      width: 160,
      height: 120,
      independentCorners: true,
      topLeftRadius: 50,
      topRightRadius: 20,
      bottomRightRadius: 50,
      bottomLeftRadius: 8,
      cornerSmoothing: 1,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.96, g: 0.35, b: 0.12, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot('corner-smoothing-profiles.png')
})

// Figma desktop (2026-11-14) scales each corner too large for its rectangle by the tighter of its
// two edges: 90, 30 and 60 on a 100 × 100 rectangle draw as 60, 25 and 40.
test('corners too large for their rectangle fit per edge', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      name: 'Oversized corners',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      independentCorners: true,
      topLeftRadius: 90,
      topRightRadius: 30,
      bottomRightRadius: 0,
      bottomLeftRadius: 60,
      fills: [
        { type: 'SOLID', color: { r: 0.23, g: 0.51, b: 0.96, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.state.zoom = 2
    store.state.panX = -100
    store.state.panY = -100
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion(400, 400)
  expect(buffer).toMatchSnapshot('oversized-corners.png', { maxDiffPixelRatio: 0, threshold: 0 })
})
