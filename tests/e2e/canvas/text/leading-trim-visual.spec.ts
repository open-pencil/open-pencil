import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

test('a cap-height trimmed text ends its box at the last baseline, as Figma does', async ({
  page
}) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const solid = (r: number, g: number, b: number) => ({
      type: 'SOLID' as const,
      color: { r, g, b, a: 1 },
      visible: true,
      opacity: 1
    })
    const card = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Card',
      width: 420,
      height: 120,
      fills: [solid(1, 1, 1)]
    })
    // Each text sits in a tinted frame that hugs it, so the box shows against the ink. Figma
    // makes the box the trimmed height to the nearest pixel, and the cap height overhangs it.
    const samples = [
      { x: 10, text: 'H8', fontSize: 24, trim: 'CAP_HEIGHT' as const },
      { x: 70, text: 'H8\nH8', fontSize: 24, trim: 'CAP_HEIGHT' as const },
      { x: 130, text: 'Hg', fontSize: 23, trim: 'CAP_HEIGHT' as const },
      { x: 190, text: 'H8', fontSize: 30, trim: 'CAP_HEIGHT' as const },
      { x: 260, text: 'H8', fontSize: 24, trim: 'NONE' as const }
    ]
    for (const sample of samples) {
      const box = store.graph.createNode('FRAME', card.id, {
        name: sample.trim,
        x: sample.x,
        y: 20,
        width: 40,
        height: 40,
        layoutMode: 'VERTICAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        fills: [solid(0.85, 0.92, 1)]
      })
      store.graph.createNode('TEXT', box.id, {
        name: sample.text,
        text: sample.text,
        width: 40,
        height: 30,
        fontFamily: 'Inter',
        fontSize: sample.fontSize,
        lineHeight: { value: 30, unit: 'PIXELS' },
        leadingTrim: sample.trim,
        textAutoResize: 'WIDTH_AND_HEIGHT',
        fills: [solid(0.1, 0.1, 0.1)]
      })
    }
    await store.loadFontsForNodes([card.id])
    store.requestRender()
  })
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(420, 120)).toMatchSnapshot('leading-trim.png')
})
