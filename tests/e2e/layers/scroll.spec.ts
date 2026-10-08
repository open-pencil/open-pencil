import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('pages and layers panels scroll inside splitter panes', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0

  // Adding a page opens it, so the layers go on the first page and the editor returns there.
  const firstPageId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    for (let i = 0; i < 80; i++) {
      store.graph.createNode('RECTANGLE', pageId, {
        name: `Layer ${i + 1}`,
        x: i * 2,
        y: i * 2,
        width: 20,
        height: 20
      })
    }
    for (let i = 0; i < 40; i++) store.addPage(`Page ${i + 2}`)
    store.switchPage(pageId)
    return pageId
  })
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.state.currentPageId))
    .toBe(firstPageId)
  await canvas.waitForRender()

  const pagesScroller = page.getByTestId('pages-scroll')
  const layersScroller = page.getByTestId('layers-scroll')

  await pagesScroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await layersScroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })

  await expect.poll(() => pagesScroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expect.poll(() => layersScroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  canvas.assertNoErrors()
})
