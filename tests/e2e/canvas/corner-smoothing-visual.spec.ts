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
