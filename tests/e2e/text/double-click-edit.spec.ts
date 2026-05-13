import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { getEditingTextId } from '#tests/helpers/store'

async function addTopLevelText(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const id = store.createShape('TEXT', 200, 200, 150, 30)
    store.graph.updateNode(id, { text: 'Hello World', fontSize: 18 })
    store.select([id])
    store.requestRender()
    return id
  })
}

async function addFrameWithNestedText(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0

    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 100,
      y: 100,
      width: 220,
      height: 120,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const text = store.graph.createNode('TEXT', frame.id, {
      name: 'Nested label',
      text: 'Nested label',
      x: 20,
      y: 20,
      width: 140,
      height: 30,
      fontSize: 18
    })
    store.select([frame.id])
    store.requestRender()
    return { frameId: frame.id, textId: text.id }
  })
}

test('double-clicking top-level text enters text edit mode', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const textId = await addTopLevelText(page)
  await canvas.waitForRender()
  await canvas.pressKey('Escape')
  await canvas.dblclick(275, 215)

  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(textId)
})

test('double-click drill selects nested text before editing it', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await addFrameWithNestedText(page)
  await canvas.waitForRender()

  await canvas.dblclick(125, 125)

  await expect.poll(() => getEditingTextId(page), { timeout: 1000 }).toBeNull()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        return [...store.state.selectedIds]
      })
    )
    .toEqual([ids.textId])

  await page.waitForTimeout(600)
  await canvas.dblclick(125, 125)
  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.textId)
})
