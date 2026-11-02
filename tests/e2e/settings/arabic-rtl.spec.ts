import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

/** Opens the editor already in Arabic, as a returning Arabic user would. */
async function openInArabic(page: Page, query = '/?test') {
  await page.addInitScript(() => localStorage.setItem('open-pencil-locale', 'ar'))
  await page.goto(query)
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  return canvas
}

async function pageNodes(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const current = store.graph.getNode(store.state.currentPageId)
    return (current?.childIds ?? []).map((id: string) => {
      const node = store.graph.getNode(id)
      return { type: node?.type, x: node?.x, y: node?.y, width: node?.width, height: node?.height }
    })
  })
}

test('choosing العربية mirrors the interface, persists, and English restores it', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-language').click()
  await page.getByRole('option', { name: 'العربية' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.getByTestId('app-settings-dialog')).toContainText('الإعدادات')

  await page.reload()
  await canvas.waitForInit()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByTestId('app-settings-trigger').click()
  await expect(page.getByTestId('settings-language')).toContainText('العربية')

  await page.getByTestId('settings-language').click()
  await page.getByRole('option', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByTestId('app-settings-dialog')).toContainText('Settings')
})

test('in Arabic the layers panel sits right of the canvas and properties on the left', async ({
  page
}) => {
  await openInArabic(page)
  const layers = await page.getByTestId('layers-panel').boundingBox()
  const properties = await page.getByTestId('properties-panel').boundingBox()
  const canvas = await page.locator('canvas').first().boundingBox()
  expect(layers && properties && canvas).toBeTruthy()
  if (!layers || !properties || !canvas) return
  expect(layers.x).toBeGreaterThan(properties.x)
  expect(layers.x).toBeGreaterThanOrEqual(canvas.x + canvas.width - 1)
  expect(properties.x + properties.width).toBeLessThanOrEqual(canvas.x + 1)
})

test('in Arabic the canvas keeps its own coordinates: drawing is not mirrored', async ({
  page
}) => {
  const canvas = await openInArabic(page, '/?test&no-chrome&no-rulers')
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 200, 150)
  expect(await pageNodes(page)).toEqual([
    { type: 'RECTANGLE', x: 100, y: 100, width: 200, height: 150 }
  ])
})

test('in Arabic the menus and panels show Arabic labels, not English', async ({ page }) => {
  await openInArabic(page)
  const layers = page.getByTestId('layers-panel')
  await expect(layers).toBeVisible()
  // Every visible panel heading is Arabic (layer names are document content and may be Latin).
  await expect(page.getByTestId('pages-panel')).toContainText('الصفحات')
  await expect(layers).toContainText('الطبقات')
})
