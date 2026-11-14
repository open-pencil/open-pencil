import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

/**
 * The thickness of the marquee's border, in CSS pixels, measured across its left edge.
 *
 * The marquee is drawn in screen pixels, so its border is a screen width. The shared selection
 * paint carries whatever the selection overlay left behind — a world width meant for the scaled
 * canvas — which would draw the border that many pixels wide: a 20px border at 5% zoom.
 */
function marqueeBorderThickness() {
  const store = window.openPencil?.getStore?.()
  const renderer = store?.canvasRenderers.find((candidate) => candidate.tracksSceneSettlement)
  const source = document.querySelector<HTMLCanvasElement>('[data-test-id="scene-canvas-element"]')
  const marquee = store?.state.marquee
  if (!store || !renderer || !source || !marquee) throw new Error('Marquee not in progress')

  // Redraw the settled frame, the overlays included, so the marquee is on the canvas the
  // pixels are read from.
  renderer.renderFromEditorState(
    store.state,
    store.graph,
    store.textEditor,
    renderer.viewportWidth,
    renderer.viewportHeight,
    false,
    'full',
    false
  )
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  const context = copy.getContext('2d', { colorSpace: 'srgb' })
  if (!context) throw new Error('sRGB canvas unavailable')
  context.drawImage(source, 0, 0)
  const dpr = devicePixelRatio
  // The border's left edge, where the opaque selection blue meets the page.
  const left = Math.round((marquee.x * store.state.zoom + store.state.panX) * dpr)
  const row = Math.round((marquee.y * store.state.zoom + store.state.panY + 20) * dpr)
  const { data } = context.getImageData(left - 4 * dpr, row, 12 * dpr, 1)
  let thickness = 0
  for (let x = 0; x < 12 * dpr; x++) {
    const i = x * 4
    // The selection colour: strongly blue, much less green.
    if (data[i + 2] > 180 && data[i + 1] < 140) thickness++
  }
  store.requestRepaint()
  return thickness / dpr
}

test('the marquee border stays one pixel wide on screen at every zoom', async () => {
  const { page, canvas } = editor

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 0.05
    store.state.panX = 0
    store.state.panY = 0
    const pageId = store.state.currentPageId
    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Large',
      x: 2000,
      y: 2000,
      width: 6000,
      height: 4000,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.55, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.requestRender()
  })
  await canvas.waitForRender()

  // The marquee only exists while the pointer is down, so the drag is held open for the
  // measurement. It catches the large rectangle and nothing else, which is the single selection
  // that leaves the widest stroke behind.
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

  const thickness = await page.evaluate(marqueeBorderThickness)
  expect(thickness, 'border at 5% zoom').toBeGreaterThan(0)
  expect(thickness, 'border at 5% zoom').toBeLessThanOrEqual(2)

  // The marquee's own top-left corner, where its border is against the page. The region stops
  // before the caught layer and its selection handles, so only the border is compared.
  expect(await canvas.screenshotCanvasRegion(95, 130)).toMatchSnapshot('marquee-border.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })

  await page.mouse.up()
  await canvas.waitForRender()
  canvas.assertNoErrors()
})
