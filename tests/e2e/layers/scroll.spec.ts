import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('pages and layers panels scroll inside splitter panes', async ({ page }) => {
  await page.goto('/?test')
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

for (const direction of ['ltr', 'rtl'] as const) {
  test(`selecting a deep layer scrolls the layers sideways to its depth (${direction})`, async ({
    page
  }) => {
    await page.goto(direction === 'rtl' ? '/?test&dir=rtl' : '/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    canvas.errors.length = 0
    await canvas.clearCanvas()

    const ids = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      let parentId = store.state.currentPageId
      const created: string[] = []
      for (let i = 0; i < 16; i++) {
        parentId = store.graph.createNode('FRAME', parentId, {
          name: `Nested frame ${i + 1}`,
          width: 200,
          height: 200
        }).id
        created.push(parentId)
      }
      const leaf = store.graph.createNode('RECTANGLE', parentId, {
        name: 'Deep layer with a long name',
        width: 20,
        height: 20
      })
      created.push(leaf.id)
      store.requestRender()
      return created
    })
    await canvas.waitForRender()

    const select = (id: string) =>
      page.evaluate((nodeId) => window.openPencil?.getStore?.()?.select([nodeId]), id)
    const scroller = page.getByTestId('layers-scroll')
    const leafRow = page.locator(`[data-node-id="${ids.at(-1)}"] [data-slot="row"]`)

    await select(ids.at(-1) ?? '')
    await expect.poll(() => scroller.evaluate((el) => Math.abs(el.scrollLeft))).toBeGreaterThan(0)

    // The deep layer's icon and the start of its name are in view, and its buttons sit inside
    // the panel's edge rather than past the end of the scrolled row.
    const bounds = await leafRow.evaluate((row) => {
      const viewport = row.closest('[data-test-id="layers-scroll"]')
      const icon = row.querySelector('[data-slot="icon"]')
      const trailing = row.querySelector('[data-slot="trailing"]')
      if (!viewport || !icon || !trailing) throw new Error('Layer row parts missing')
      const box = (el: Element) => {
        const rect = el.getBoundingClientRect()
        return { left: rect.left, right: rect.right }
      }
      return { viewport: box(viewport), icon: box(icon), trailing: box(trailing) }
    })
    for (const part of [bounds.icon, bounds.trailing]) {
      expect(part.left).toBeGreaterThanOrEqual(bounds.viewport.left)
      expect(part.right).toBeLessThanOrEqual(bounds.viewport.right)
    }

    await select(ids[0])
    await expect.poll(() => scroller.evaluate((el) => Math.abs(el.scrollLeft))).toBe(0)
    canvas.assertNoErrors()
  })
}
