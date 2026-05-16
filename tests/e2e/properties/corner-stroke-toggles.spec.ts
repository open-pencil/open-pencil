import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { getSelectedNode } from '#tests/helpers/store'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})


async function drawFrame(x: number, y: number, w: number, h: number) {
  await canvas.pressKey('f')
  await canvas.drag(x, y, x + w, y + h)
  await canvas.waitForRender()
}

test('independent corners toggle shows per-corner inputs', async () => {
  await drawFrame(120, 120, 120, 80)
  await canvas.waitForRender()

  const flags = await getSelectedNode(page)
  expect(flags?.type).toBe('FRAME')
  expect(flags?.independentCorners).toBe(false)

  const toggle = page.getByTestId('independent-corners-toggle')
  await expect(toggle).toBeVisible()

  await toggle.click()
  await canvas.waitForRender()

  expect((await getSelectedNode(page))?.independentCorners).toBe(true)
  const grid = page.getByTestId('independent-corners-grid')
  await expect(grid).toBeVisible()
  const cornerInputs = grid.getByTestId('scrub-input')
  expect(await cornerInputs.count()).toBe(4)

  await toggle.click()
  await canvas.waitForRender()
  await expect(grid).not.toBeVisible()
})

test('stroke sides toggle shows per-side weight inputs', async () => {
  await drawFrame(300, 50, 120, 80)
  await canvas.waitForRender()

  const addStroke = page.getByTestId('stroke-section-add')
  await expect(addStroke).toBeVisible()
  await addStroke.click()
  await canvas.waitForRender()

  const toggle = page.getByTestId('stroke-sides-toggle')
  await expect(toggle).toBeVisible({ timeout: 5000 })

  const sectionInputsBefore = await page
    .getByTestId('stroke-section').getByTestId('scrub-input')
    .count()

  await toggle.click()
  await canvas.waitForRender()

  const sectionInputsAfter = await page
    .getByTestId('stroke-section').getByTestId('scrub-input')
    .count()
  expect(sectionInputsAfter).toBeGreaterThan(sectionInputsBefore)

  await toggle.click()
  await canvas.waitForRender()

  const sectionInputsFinal = await page
    .getByTestId('stroke-section').getByTestId('scrub-input')
    .count()
  expect(sectionInputsFinal).toBe(sectionInputsBefore)
})
