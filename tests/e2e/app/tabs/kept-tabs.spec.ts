import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

test('a reload keeps the designs open in tabs, in order, with the one in front', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()

  async function drawIn(name: string) {
    await page.evaluate(async (name) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const id = store.createShape('RECTANGLE', 120, 120, 240, 140)
      store.updateNode(id, { name })
      await store.persistRecoveryNow()
    }, name)
  }
  await drawIn('First kept rectangle')
  await page.keyboard.press('ControlOrMeta+t')
  await page.getByRole('button', { name: 'Design', exact: true }).first().click()
  await drawIn('Second kept rectangle')
  const tabs = page.getByTestId('tabbar-tab')
  const address = new URL(page.url()).pathname

  await page.reload()
  // The second design is in front, at the address it had.
  await expect(page.getByText('Second kept rectangle')).toBeVisible()
  await expect.poll(() => new URL(page.url()).pathname).toBe(address)
  // The first comes back in the tab before it.
  const count = await tabs.count()
  await tabs.nth(count - 2).click()
  await expect(page.getByText('First kept rectangle')).toBeVisible()

  await context.close()
})

test('a renamed design keeps its name across a reload', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.createShape('RECTANGLE', 120, 120, 240, 140)
    await store.persistRecoveryNow()
  })
  await page.evaluate(() => window.openPencil?.getStore?.()?.renameDocument('Landing page'))
  // The copy takes the new name at once, well before the few seconds edits wait to be written.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const request = indexedDB.open('open-pencil-recovery')
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const all = database.transaction('meta').objectStore('meta').getAll()
          const names = await new Promise<unknown[]>((resolve, reject) => {
            all.onsuccess = () => resolve(all.result)
            all.onerror = () => reject(all.error)
          })
          return names.map((meta) =>
            typeof meta === 'object' && meta && 'documentName' in meta ? meta.documentName : null
          )
        }),
      { timeout: 1500 }
    )
    .toContain('Landing page')

  await page.reload()
  await expect(page.getByTestId('tabbar-tab').filter({ hasText: 'Landing page' })).toBeVisible()

  await context.close()
})
