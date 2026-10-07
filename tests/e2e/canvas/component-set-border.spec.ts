import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

/**
 * The thickest run of border-coloured pixels, in CSS pixels, across the top edge of the set
 * `setId` near its right end, clear of the left-aligned labels, at `zoom`, drawn with every pass
 * as a settled frame is, through the pictures cached at earlier zooms.
 */
function borderThickness({ setId, zoom }: { setId: string; zoom: number }) {
  const store = window.openPencil?.getStore?.()
  const renderer = store?.canvasRenderers.find((candidate) => candidate.tracksSceneSettlement)
  const source = document.querySelector<HTMLCanvasElement>('[data-test-id="scene-canvas-element"]')
  const set = store?.graph.getNode(setId)
  if (!store || !renderer || !source || !set) throw new Error('Scene canvas unavailable')
  const origin = store.graph.getAbsolutePosition(setId)
  const sampleX = origin.x + set.width - 40
  store.centerOn(sampleX, origin.y, zoom)
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
  const top = Math.round((origin.y * store.state.zoom + store.state.panY) * dpr)
  const band = 4 * dpr
  const width = Math.round(40 * dpr)
  const left = Math.round(copy.width / 2 - width / 2)
  const { data } = context.getImageData(left, top - band, width, band * 2)
  let thickest = 0
  for (let x = 0; x < width; x++) {
    let rows = 0
    for (let y = 0; y < band * 2; y++) {
      const i = (y * width + x) * 4
      // The component colour, #9747ff: strongly blue, much less green.
      if (data[i + 2] > 180 && data[i + 1] < 140) rows++
    }
    thickest = Math.max(thickest, rows)
  }
  store.requestRepaint()
  return thickest / dpr
}

test('a component set border stays one pixel wide on screen at every zoom', async ({ page }) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const setId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const set = store.graph.createNode('COMPONENT_SET', store.state.currentPageId, {
      name: 'Button',
      x: 200,
      y: 200,
      width: 240,
      height: 120,
      fills: []
    })
    store.graph.createNode('COMPONENT', set.id, { x: 20, y: 20, width: 80, height: 40 })
    store.requestRender()
    return set.id
  })
  await canvas.waitForRender()

  for (const zoom of [1, 4]) {
    const thickness = await page.evaluate(borderThickness, { setId, zoom })
    expect(thickness, `border at ${zoom}x`).toBeGreaterThan(0)
    expect(thickness, `border at ${zoom}x`).toBeLessThanOrEqual(2)
  }
})
