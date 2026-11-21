import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

const DESIGN_PATH = /^\/design\/[\w-]+$/

test('a design kept only on this device reopens from its address after a reload', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()

  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('RECTANGLE', 120, 120, 240, 140)
    store.updateNode(id, { name: 'Addressed rectangle' })
    await store.persistRecoveryNow()
  })
  await expect.poll(() => new URL(page.url()).pathname).toMatch(DESIGN_PATH)
  const address = new URL(page.url()).pathname

  page.once('dialog', (dialog) => dialog.accept())
  await page.reload({ waitUntil: 'commit' })
  await expect(page.locator('html')).toHaveAttribute('data-opening-design', '')
  await expect(page.getByText('Addressed rectangle')).toBeVisible()
  // The boot splash held the app while the design opened, and goes once it has.
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-design')
  await expect(page.locator('#boot-splash')).toBeHidden()
  await expect.poll(() => new URL(page.url()).pathname).toBe(address)

  await context.close()
})

test('a design opened from its Home card reopens from its address after a reload', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({ baseURL })
  // A window that left unsaved work behind, which Home then offers as a card.
  const earlier = await context.newPage()
  await earlier.goto('/?test')
  await new CanvasHelper(earlier).waitForInit()
  await earlier.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('RECTANGLE', 120, 120, 240, 140)
    store.updateNode(id, { name: 'Card rectangle' })
    await store.persistRecoveryNow()
  })
  await earlier.close({ runBeforeUnload: true })

  const page = await context.newPage()
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/?recent-files')
  const card = page.getByTestId('home-recovery').locator('[data-slot="document-entry"]')
  await card.locator('[data-slot="trigger"]').click()
  await expect(page.getByText('Card rectangle')).toBeVisible()
  // The address names the copy the tab took over, not the ID the tab started with.
  await expect.poll(() => new URL(page.url()).pathname).toMatch(DESIGN_PATH)
  const address = new URL(page.url()).pathname

  await page.reload()
  await expect(page.getByText('Card rectangle')).toBeVisible()
  await expect.poll(() => new URL(page.url()).pathname).toBe(address)

  await context.close()
})

for (const address of ['/design/missing-design', '/design', '/design/']) {
  test(`${address} with no design to show goes to the base address`, async ({ page }) => {
    await page.goto(address)
    await expect.poll(() => new URL(page.url()).pathname).toBe('/')
    await expect(page.getByTestId('recent-files-home')).toBeVisible()
    await expect(page.locator('#boot-splash')).toBeHidden()
  })
}

test('an address with no design to show keeps its query on the base address', async ({ page }) => {
  await page.goto('/design/missing-design?test')
  await new CanvasHelper(page).waitForInit()
  await expect.poll(() => new URL(page.url()).search).toBe('?test')
})

test('reloading a design that was never edited opens the editor again', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.reload()
  await canvas.waitForInit()
})
