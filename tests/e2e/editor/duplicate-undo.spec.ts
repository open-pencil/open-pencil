import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

test.beforeEach(async () => {
  await canvas.clearCanvas()
})

async function rectangleCount() {
  return page.evaluate(() => {
    const store = window.openPencil?.store
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.graph.nodes.values()].filter((node) => node.type === 'RECTANGLE').length
  })
}

async function layerItems() {
  return page.locator('[data-test-id="layers-item"]').allTextContents()
}

async function historyState() {
  return page.evaluate(() => {
    const store = window.openPencil?.store
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      canUndo: store.undo.canUndo,
      canRedo: store.undo.canRedo,
      undoLabel: store.undo.undoLabel,
      redoLabel: store.undo.redoLabel
    }
  })
}

test('undo after option-drag duplicate removes the copy', async () => {
  await canvas.drawRect(120, 120, 120, 90)
  await expect.poll(rectangleCount).toBe(1)

  await canvas.altDrag(180, 165, 340, 165)
  await expect.poll(rectangleCount).toBe(2)
  await expect.poll(layerItems).toEqual(['Rectangle', 'Rectangle copy'])

  await canvas.undo()
  await expect.poll(rectangleCount).toBe(1)
  await expect.poll(layerItems).toEqual(['Rectangle'])
  await expect.poll(historyState).toMatchObject({ canRedo: true, redoLabel: 'Duplicate' })

  await page.waitForTimeout(1500)
  await expect.poll(rectangleCount).toBe(1)
  await expect.poll(layerItems).toEqual(['Rectangle'])
  await expect.poll(historyState).toMatchObject({ canRedo: true, redoLabel: 'Duplicate' })

  await page.keyboard.down('Meta')
  await page.keyboard.down('Shift')
  await page.keyboard.press('KeyZ')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Meta')
  await canvas.waitForRender()
  await expect.poll(rectangleCount).toBe(2)
  await expect.poll(layerItems).toEqual(['Rectangle', 'Rectangle copy'])
  await expect.poll(historyState).toMatchObject({ canUndo: true, undoLabel: 'Duplicate' })

  await page.waitForTimeout(1500)
  await expect.poll(rectangleCount).toBe(2)
  await expect.poll(layerItems).toEqual(['Rectangle', 'Rectangle copy'])
  await expect.poll(historyState).toMatchObject({ canUndo: true, undoLabel: 'Duplicate' })
  canvas.assertNoErrors()
})
