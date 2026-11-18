import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { showView } from '#tests/helpers/canvas/page-scene'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

// Figma strokes the marquee one screen pixel wide at every zoom. At 5% a single caught layer
// leaves its 1/zoom world outline width on the shared selection paint, which drew the marquee's
// border as a 20 px band.
test('the marquee border stays one pixel wide at 5% zoom', async () => {
  const { page, canvas } = editor

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      name: 'Large',
      x: 2000,
      y: 2000,
      width: 6000,
      height: 4000,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.55, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
  })
  await showView(page, { zoom: 0.05, panX: 0, panY: 0 })
  await canvas.waitForRender()

  // The marquee exists only while the pointer is down, so the drag is held open for the capture.
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')
  await page.mouse.move(box.x + 60, box.y + 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 350, { steps: 10 })
  await canvas.waitForRender()

  const selected = await page.evaluate(
    () => window.openPencil?.getStore?.().state.selectedIds.size ?? 0
  )
  expect(selected, 'the marquee catches one layer').toBe(1)

  // The marquee's top-left corner against the page, short of the caught layer and its handles.
  expect(await canvas.screenshotCanvasRegion(95, 130)).toMatchSnapshot('marquee-border.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })

  await page.mouse.up()
  await canvas.waitForRender()
  canvas.assertNoErrors()
})
