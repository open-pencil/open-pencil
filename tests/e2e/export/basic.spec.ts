import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test.describe.configure({ mode: 'serial' })

let page: Page
let canvas: CanvasHelper

test('add export row increases row count', async ({ browser }) => {
  test.setTimeout(120_000)
  const context = await browser.newContext()
  page = await context.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 100)

  const before = await page.getByTestId('export-item').count()
  await page.getByTestId('export-section-add').click()
  await canvas.waitForRender()
  const after = await page.getByTestId('export-item').count()
  expect(after).toBe(before + 1)
  canvas.assertNoErrors()
})

test('remove export row decreases row count', async () => {
  test.setTimeout(30_000)
  await page.getByTestId('export-section-add').click()
  await canvas.waitForRender()

  const before = await page.getByTestId('export-item').count()
  await page.getByTestId('export-item').first().locator('button').last().click()
  await canvas.waitForRender()

  const after = await page.getByTestId('export-item').count()
  expect(after).toBe(before - 1)
  canvas.assertNoErrors()
})

test('format selector changes to JPG', async () => {
  test.setTimeout(30_000)
  const formatTrigger = page
    .getByTestId('export-item')
    .first()
    .getByTestId('app-select-trigger')
    .last()
  await formatTrigger.click()
  await page.locator('[role="option"]').filter({ hasText: 'JPG' }).click()
  await canvas.waitForRender()
  await expect(formatTrigger).toHaveText('JPG')
  canvas.assertNoErrors()
})

test('SVG format hides scale selector', async () => {
  test.setTimeout(30_000)
  const formatTrigger = page
    .getByTestId('export-item')
    .first()
    .getByTestId('app-select-trigger')
    .last()
  await formatTrigger.click()
  await page.locator('[role="option"]').filter({ hasText: 'SVG' }).click()
  await canvas.waitForRender()
  const selects = page.getByTestId('export-item').first().getByTestId('app-select-trigger')
  await expect(selects).toHaveCount(1)
  canvas.assertNoErrors()
})

test('preview toggle shows image with blob src', async () => {
  test.setTimeout(30_000)
  const formatTrigger = page
    .getByTestId('export-item')
    .first()
    .getByTestId('app-select-trigger')
    .last()
  await formatTrigger.click()
  await page.locator('[role="option"]').filter({ hasText: 'PNG' }).click()
  await canvas.waitForRender()
  await page.getByTestId('export-preview-toggle').click()
  const img = page.getByTestId('export-section').locator('img')
  await expect(img).toBeVisible({ timeout: 10000 })
  const src = await img.getAttribute('src')
  expect(src).toMatch(/^blob:/)
  canvas.assertNoErrors()
})

test.afterAll(async () => {
  if (page && !page.isClosed()) {
    await page.context().close()
  }
})
