import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Figma desktop: a polygon's or star's corners, inner ones included, round with circular arcs
// that shrink to fit along short edges, and corner smoothing eases them into the edges.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('rounded and smoothed polygons and stars', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const shapes: Array<{
      type: 'POLYGON' | 'STAR'
      pointCount: number
      cornerRadius: number
      cornerSmoothing: number
      height?: number
    }> = [
      { type: 'POLYGON', pointCount: 3, cornerRadius: 24, cornerSmoothing: 0 },
      { type: 'POLYGON', pointCount: 6, cornerRadius: 100, cornerSmoothing: 0, height: 60 },
      { type: 'STAR', pointCount: 5, cornerRadius: 10, cornerSmoothing: 0 },
      { type: 'STAR', pointCount: 5, cornerRadius: 30, cornerSmoothing: 0 },
      { type: 'POLYGON', pointCount: 3, cornerRadius: 24, cornerSmoothing: 0.6 },
      { type: 'STAR', pointCount: 5, cornerRadius: 10, cornerSmoothing: 0.6 }
    ]
    shapes.forEach(({ type, height = 160, ...corners }, index) =>
      store.graph.createNode(type, store.state.currentPageId, {
        x: (index % 3) * 180,
        y: Math.floor(index / 3) * 180,
        width: 160,
        height,
        starInnerRadius: 0.382,
        fills: [
          { type: 'SOLID', visible: true, opacity: 1, color: { r: 0.8, g: 0.6, b: 0.6, a: 1 } }
        ],
        ...corners
      })
    )
    store.state.zoom = 1
    store.state.panX = 40
    store.state.panY = 40
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  expect(await editor.canvas.screenshotCanvasRegion(620, 420)).toMatchSnapshot('polygons.png')
  editor.canvas.assertNoErrors()
})
