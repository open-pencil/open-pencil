import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

test('variable text follows its font size on the optical size axis unless detached', async ({
  page
}) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const card = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Card',
      width: 520,
      height: 150,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    // Inter's optical size runs from 14 to 32, so at 32 and 48 the automatic axis leaves the
    // default the detached text keeps.
    const rows = [
      { y: 10, fontSize: 32, opticalSizeFromFontSize: true },
      { y: 50, fontSize: 32, opticalSizeFromFontSize: false },
      { y: 90, fontSize: 48, opticalSizeFromFontSize: true }
    ]
    for (const row of rows) {
      store.graph.createNode('TEXT', card.id, {
        name: row.opticalSizeFromFontSize ? 'Automatic' : 'Detached',
        text: 'Hamburgefonstiv',
        x: 10,
        y: row.y,
        width: 500,
        height: row.fontSize * 1.2,
        fontFamily: 'Inter',
        fontSize: row.fontSize,
        opticalSizeFromFontSize: row.opticalSizeFromFontSize,
        textAutoResize: 'WIDTH_AND_HEIGHT',
        fills: [
          { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }
        ]
      })
    }
    await store.loadFontsForNodes([card.id])
    store.requestRender()
  })
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(520, 150)).toMatchSnapshot('optical-size.png')
})
