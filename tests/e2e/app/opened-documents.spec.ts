import { expect, test } from '@playwright/test'

import type * as AppTabs from '@/app/tabs'

import { CanvasHelper } from '#tests/helpers/canvas'
import { testPath } from '#tests/helpers/paths'

// An auto-layout file whose layout the app recomputes on its first page.
const FIXTURE = 'gold-preview.fig'

// Opening a page lays it out, which updates node sizes and positions but is not an edit.
test('an opened .fig file stays saved until it is edited', async ({ page }) => {
  await page.route(`**/__fixtures/${FIXTURE}`, (route) =>
    route.fulfill({ path: testPath('fixtures', FIXTURE) })
  )
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.evaluate(async (fixture) => {
    const tabsURL = '/src/app/tabs/index.ts'
    const tabs: typeof AppTabs = await import(tabsURL)
    const response = await fetch(`/__fixtures/${fixture}`)
    await tabs.openFileInNewTab(new File([await response.arrayBuffer()], fixture))
  }, FIXTURE)

  const tab = page.locator('[data-slot="tab-item"]').filter({ hasText: 'gold-preview' })
  await expect(tab).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.state.preparation ?? null))
    .toBeNull()
  await expect(tab.getByRole('img', { name: 'Unsaved changes' })).toHaveCount(0)

  await tab.getByTestId('tabbar-close').click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(tab).toHaveCount(0)
})
