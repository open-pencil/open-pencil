import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 100)
})

test.afterAll(async () => {
  await page.close()
})

function exportItems() {
  return page.locator('[data-test-id="export-item"]')
}

test('add export row increases row count', async () => {
  const before = await exportItems().count()

  await page.locator('[data-test-id="export-section-add"]').click()
  await canvas.waitForRender()

  const after = await exportItems().count()
  expect(after).toBe(before + 1)
  canvas.assertNoErrors()
})

test('remove export row decreases row count', async () => {
  await page.locator('[data-test-id="export-section-add"]').click()
  await canvas.waitForRender()

  const before = await exportItems().count()
  await exportItems().first().locator('button').last().click()
  await canvas.waitForRender()

  const after = await exportItems().count()
  expect(after).toBe(before - 1)
  canvas.assertNoErrors()
})

test('format selector changes to JPG', async () => {
  const formatTrigger = exportItems().first().locator('[data-test-id="app-select-trigger"]').last()
  await formatTrigger.click()

  await page.locator('[role="option"]').filter({ hasText: 'JPG' }).click()
  await canvas.waitForRender()

  await expect(formatTrigger).toHaveText('JPG')
  canvas.assertNoErrors()
})

test('SVG format hides scale selector', async () => {
  const formatTrigger = exportItems().first().locator('[data-test-id="app-select-trigger"]').last()
  await formatTrigger.click()

  await page.locator('[role="option"]').filter({ hasText: 'SVG' }).click()
  await canvas.waitForRender()

  const selects = exportItems().first().locator('[data-test-id="app-select-trigger"]')
  await expect(selects).toHaveCount(1)
  canvas.assertNoErrors()
})

test('preview toggle shows image with blob src', async () => {
  const formatTrigger = exportItems().first().locator('[data-test-id="app-select-trigger"]').last()
  await formatTrigger.click()
  await page.locator('[role="option"]').filter({ hasText: 'PNG' }).click()
  await canvas.waitForRender()

  await page.locator('[data-test-id="export-preview-toggle"]').click()

  const img = page.locator('[data-test-id="export-section"] img')
  await expect(img).toBeVisible({ timeout: 10000 })

  const src = await img.getAttribute('src')
  expect(src).toMatch(/^blob:/)
  canvas.assertNoErrors()
})
