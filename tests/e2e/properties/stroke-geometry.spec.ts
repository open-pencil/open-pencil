import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/editor')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

async function drawStrokedRectangle(x: number, y: number) {
  await canvas.pressKey('r')
  await canvas.drag(x, y, x + 120, y + 80)
  await canvas.waitForRender()
  await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await canvas.waitForRender()
}

async function selectedStrokeGeometry() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds].map((id) => {
      const node = store.graph.getNode(id)
      return node
        ? {
            cap: node.strokeCap,
            join: node.strokeJoin,
            miterLimit: node.strokeMiterLimit,
            paintCaps: node.strokes.map((stroke) => stroke.cap),
            paintJoins: node.strokes.map((stroke) => stroke.join)
          }
        : null
    })
  })
}

test('shows geometry controls only after a stroke is added', async () => {
  await canvas.pressKey('r')
  await canvas.drag(100, 100, 220, 180)
  await canvas.waitForRender()
  await expect(page.locator('[data-property="stroke-cap"]')).not.toBeVisible()

  await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await canvas.waitForRender()
  await expect(page.locator('[data-property="stroke-cap"]')).toBeVisible()
  await expect(page.locator('[data-property="stroke-join"]')).toBeVisible()
  await expect(page.locator('[data-property="stroke-miter-limit"]')).toBeVisible()
})

test('updates cap, join, and miter state from compact controls', async () => {
  const section = propertySection(page, 'Stroke')
  await section.getByRole('button', { name: 'Round cap' }).click()
  await section.getByRole('button', { name: 'Bevel join' }).click()
  await section.getByRole('spinbutton', { name: 'Miter limit' }).focus()
  const miter = section.getByRole('spinbutton', { name: 'Miter limit' })
  await miter.fill('12')
  await miter.press('Enter')
  await canvas.waitForRender()

  expect(await selectedStrokeGeometry()).toEqual([
    {
      cap: 'ROUND',
      join: 'BEVEL',
      miterLimit: 12,
      paintCaps: ['ROUND'],
      paintJoins: ['BEVEL']
    }
  ])

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect((await selectedStrokeGeometry())[0]?.miterLimit).toBe(4)
})

test('applies mixed multi-selection joins in one undo step', async () => {
  await canvas.clearCanvas()
  await drawStrokedRectangle(80, 80)
  await drawStrokedRectangle(260, 80)
  await canvas.pressKey('Meta+a')
  await canvas.waitForRender()

  const roundJoin = propertySection(page, 'Stroke').getByRole('button', { name: 'Round join' })
  await expect(roundJoin).toBeVisible()
  await roundJoin.click()
  await canvas.waitForRender()
  expect((await selectedStrokeGeometry()).map((value) => value?.join)).toEqual(['ROUND', 'ROUND'])

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect((await selectedStrokeGeometry()).map((value) => value?.join)).toEqual(['MITER', 'MITER'])
})
