import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

test('keeps recovery independent from cancelling an unsaved-document close', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('RECTANGLE', 120, 120, 240, 140)
    await store.persistRecoveryNow()
    store.updateNode(id, { name: 'Retained recovery rectangle' })
    await store.persistRecoveryNow()
  })

  await page.keyboard.press('ControlOrMeta+t')
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(2)
  await page.locator('[data-slot="tab-item"]').first().getByTestId('tabbar-close').click()
  await expect(page.getByRole('alertdialog', { name: /Save changes to/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(2)
  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const request = indexedDB.open('open-pencil-recovery')
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        const transaction = database.transaction('meta')
        const countRequest = transaction.objectStore('meta').count()
        return new Promise<number>((resolve, reject) => {
          countRequest.onsuccess = () => resolve(countRequest.result)
          countRequest.onerror = () => reject(countRequest.error)
        })
      })
    )
    .toBe(1)

  // A reload leaves the copy on purpose, so Home lists it rather than asking at start.
  page.once('dialog', (dialog) => dialog.accept())
  await page.goto('/?recent-files')
  const kept = page.getByTestId('home-recovery').locator('[data-slot="document-entry"]')
  await expect(kept).toHaveCount(1)
  await expect(page.getByRole('alertdialog', { name: 'Recover unsaved work' })).toHaveCount(0)
  await kept.locator('[data-slot="trigger"]').click()
  await expect(page.getByText('Retained recovery rectangle')).toBeVisible()
  await expect(page.getByTestId('home-recovery')).toHaveCount(0)

  await context.close()
})

test('asks to recover the unsaved work of a window that crashed', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  const crashing = await context.newPage()
  await crashing.goto('/?test')
  await new CanvasHelper(crashing).waitForInit()
  await crashing.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('RECTANGLE', 120, 120, 240, 140)
    store.updateNode(id, { name: 'Crashed recovery rectangle' })
    await store.persistRecoveryNow()
  })
  // The renderer goes away without unloading the page, as in a crash.
  const cdp = await context.newCDPSession(crashing)
  const crashed = crashing.waitForEvent('crash')
  // Chromium never answers this command: the page it would answer from is gone.
  void cdp.send('Page.crash').catch(() => undefined)
  await crashed

  const page = await context.newPage()
  await page.goto('/?recent-files')
  const dialog = page.getByRole('alertdialog', { name: 'Recover unsaved work' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Crashed recovery rectangle')).toBeVisible()

  await context.close()
})
