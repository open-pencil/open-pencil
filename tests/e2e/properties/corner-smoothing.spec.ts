import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/editor?new=design')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

async function drawFrame(x: number, y: number) {
  await canvas.pressKey('f')
  await canvas.drag(x, y, x + 120, y + 80)
  await canvas.waitForRender()
}

async function selectedSmoothing() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds].map(
      (id) => store.graph.getNode(id)?.cornerSmoothing ?? null
    )
  })
}

async function fillSmoothing(value: string) {
  const section = propertySection(page, 'Appearance')
  await section.getByRole('spinbutton', { name: 'Corner smoothing' }).focus()
  const input = section.getByRole('spinbutton', { name: 'Corner smoothing' })
  await input.fill(value)
  await input.press('Enter')
  await canvas.waitForRender()
}

test('shows smoothing for corner-capable nodes and keeps it with independent radii', async () => {
  await drawFrame(100, 100)
  const smoothing = page.locator('[data-property="corner-smoothing"]')
  await expect(smoothing).toBeVisible()

  const independent = propertySection(page, 'Appearance').getByRole('button', {
    name: 'Independent corner radii'
  })
  await independent.click()
  await canvas.waitForRender()
  await expect(page.locator('[data-corner-grid]')).toBeVisible()
  await expect(smoothing).toBeVisible()

  await canvas.pressKey('l')
  await canvas.drag(300, 100, 420, 160)
  await canvas.waitForRender()
  await expect(smoothing).not.toBeVisible()
})

test('updates normalized smoothing and undoes the committed edit', async () => {
  await drawFrame(100, 240)
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (id) store.updateNode(id, { cornerRadius: 24 })
  })
  await fillSmoothing('75')
  expect(await selectedSmoothing()).toEqual([0.75])

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await selectedSmoothing()).toEqual([0])
})

test('restores mixed per-node values in one undo step', async () => {
  await canvas.clearCanvas()
  await drawFrame(80, 80)
  await drawFrame(260, 80)
  await canvas.pressKey('Meta+a')
  await canvas.waitForRender()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const ids = [...store.state.selectedIds]
    if (ids[0]) store.updateNode(ids[0], { cornerRadius: 20, cornerSmoothing: 0.2 })
    if (ids[1]) store.updateNode(ids[1], { cornerRadius: 20, cornerSmoothing: 0.8 })
  })
  await canvas.waitForRender()

  await fillSmoothing('60')
  expect(await selectedSmoothing()).toEqual([0.6, 0.6])

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await selectedSmoothing()).toEqual([0.2, 0.8])
})
