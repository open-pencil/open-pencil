import { expect, type Page } from '@playwright/test'

/**
 * Opens a top-level menu of the app's menubar and returns it. A menu closed while its opening
 * animation still runs stays in the page until the animation ends and dismisses the next menu
 * opened in that time, so this waits for every menu to go before clicking the trigger.
 */
export async function openAppMenu(page: Page, name: string) {
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.getByRole('menubar').getByRole('menuitem', { name, exact: true }).click()
  const menu = page.getByRole('menu', { name })
  await expect(menu).toBeVisible()
  return menu
}
