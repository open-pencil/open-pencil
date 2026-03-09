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
})

test.afterAll(async () => {
  await page.close()
})

async function createColorVariable(name: string) {
  return page.evaluate((varName: string) => {
    const store = window.__OPEN_PENCIL_STORE__!
    const existing = [...store.graph.variableCollections.values()]
    const col = existing.length > 0 ? existing[0] : store.graph.createCollection('Test Collection')
    const v = store.graph.createVariable(varName, 'COLOR', col.id, { r: 1, g: 0, b: 0, a: 1 })
    store.state.sceneVersion++
    return v.id
  }, name)
}

function variableRows() {
  return page.locator('[data-test-id="variable-row"]')
}

test('variables dialog opens', async () => {
  await createColorVariable('primary-color')

  await page.locator('[data-test-id="variables-section-open"]').click()
  await expect(page.locator('[data-test-id="variables-dialog"]')).toBeVisible()
  canvas.assertNoErrors()
})

test('search filters variable rows', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const col = [...store.graph.variableCollections.values()][0]
    store.graph.createVariable('beta-spacing', 'FLOAT', col.id, 8)
    store.state.sceneVersion++
  })
  await canvas.waitForRender()

  const searchInput = page.locator('[data-test-id="variables-search-input"]')
  await searchInput.fill('primary')

  await expect(variableRows()).toHaveCount(1, { timeout: 3000 })
  canvas.assertNoErrors()
})

test('click name cell activates editable input', async () => {
  await page.locator('[data-test-id="variables-search-input"]').fill('')
  await canvas.waitForRender()

  const firstRow = variableRows().first()
  const nameCell = firstRow.locator('td').first()
  await nameCell.click()
  await canvas.waitForRender()

  const editableInput = nameCell.locator('input, [contenteditable]').first()
  await expect(editableInput).toBeFocused()
  canvas.assertNoErrors()
})

test('color swatch opens color picker', async () => {
  await createColorVariable('SwatchVar')
  // close dialog if open from previous test
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.locator('[data-test-id="variables-section-open"]').click()
  await expect(page.locator('[data-test-id="variables-dialog"]')).toBeVisible({ timeout: 3000 })

  const swatch = page.locator('[data-test-id="variable-row"]').first().locator('[data-test-id="color-picker-swatch"]')
  await expect(swatch).toBeVisible({ timeout: 3000 })
  await swatch.click()
  await expect(page.locator('[data-test-id="color-picker-popover"]')).toBeVisible({ timeout: 5000 })
  canvas.assertNoErrors()
})
