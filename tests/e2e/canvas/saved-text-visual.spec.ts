import { readFile } from 'node:fs/promises'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

const MESSAGE = 'A sentence long enough that it has to wrap onto a second line.'

test('wrapped text keeps its lines after a .fig is saved and reopened (#914)', async ({ page }) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.evaluate((message) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const card = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Card',
      width: 260,
      height: 52,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.graph.createNode('TEXT', card.id, {
      name: 'Message',
      text: message,
      x: 10,
      y: 10,
      width: 230,
      height: 32,
      fontFamily: 'Inter',
      fontSize: 13,
      lineHeight: 16,
      textAutoResize: 'HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
  }, MESSAGE)

  const picker = await page.evaluateHandle(() => {
    const original = window.showSaveFilePicker
    window.showSaveFilePicker = undefined
    return {
      restore: () => {
        window.showSaveFilePicker = original
      }
    }
  })
  let bytes: number[]
  try {
    page.once('dialog', (dialog) => dialog.accept('Card.fig'))
    const download = page.waitForEvent('download')
    await page.evaluate(() => window.openPencil?.getStore?.().saveFigFileAs())
    bytes = [...(await readFile(await (await download).path()))]
  } finally {
    await picker.evaluate((handle) => handle.restore())
    await picker.dispose()
  }

  const lines = await page.evaluate(async (saved) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    await store.openFigFile(new File([new Uint8Array(saved)], 'Card.fig'))
    const message = [...store.graph.nodes.values()].find((node) => node.name === 'Message')
    store.requestRender()
    return new Set(message?.derivedTextGlyphs?.map((glyph) => glyph.y)).size
  }, bytes)
  expect(lines).toBe(2)
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion()).toMatchSnapshot('reopened-wrapped-text.png')
})
