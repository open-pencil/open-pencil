import { expect, test, type Page } from '@playwright/test'

import type * as AppTabs from '@/app/tabs'

import { CanvasHelper } from '#tests/helpers/canvas'
import { testPath } from '#tests/helpers/paths'

async function openFixture(page: Page, fixture: string) {
  await page.route(`**/__fixtures/${fixture}`, (route) =>
    route.fulfill({ path: testPath('fixtures', fixture) })
  )
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.evaluate(async (name) => {
    const tabsURL = '/src/app/tabs/index.ts'
    const tabs: typeof AppTabs = await import(tabsURL)
    const response = await fetch(`/__fixtures/${name}`)
    await tabs.openFileInNewTab(new File([await response.arrayBuffer()], name))
  }, fixture)
  const tab = page
    .locator('[data-slot="tab-item"]')
    .filter({ hasText: fixture.replace(/\.fig$/, '') })
  await expect(tab).toBeVisible()
  await waitForPreparation(page)
  return tab
}

async function waitForPreparation(page: Page) {
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.state.preparation ?? null))
    .toBeNull()
}

// Opening a page lays it out, which updates node sizes and positions but is not an edit.
test('an opened .fig file stays saved until it is edited', async ({ page }) => {
  // An auto-layout file whose layout the app recomputes on its first page.
  const tab = await openFixture(page, 'gold-preview.fig')
  await expect(tab.getByRole('img', { name: 'Unsaved changes' })).toHaveCount(0)

  await tab.getByTestId('tabbar-close').click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(tab).toHaveCount(0)
})

// A page's layers load from the opened file the first time it is shown.
test('showing another page of an opened .fig file keeps it saved', async ({ page }) => {
  const tab = await openFixture(page, 'slots.fig')
  await page.getByTestId('pages-item').filter({ hasText: 'Slots fixture' }).click()
  await waitForPreparation(page)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        return store ? store.graph.getChildren(store.state.currentPageId).length : 0
      })
    )
    .toBeGreaterThan(0)
  await expect(tab.getByRole('img', { name: 'Unsaved changes' })).toHaveCount(0)

  await tab.getByTestId('tabbar-close').click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(tab).toHaveCount(0)
})
