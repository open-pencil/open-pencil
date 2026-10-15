import { expect, type Page } from '@playwright/test'

/**
 * Opens the main menu from the logo and returns it. A menu closed while its opening animation
 * still runs stays in the page until the animation ends and dismisses the next menu opened in
 * that time, so this waits for every menu to go before clicking the logo.
 */
export async function openMainMenu(page: Page) {
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.getByRole('button', { name: 'Main menu', exact: true }).click()
  const menu = page.getByRole('menu', { name: 'Main menu' })
  await expect(menu).toBeVisible()
  return menu
}

/** Opens one of the main menu's submenus, such as File or Preferences, and returns it. */
export async function openAppMenu(page: Page, name: string) {
  const mainMenu = await openMainMenu(page)
  await mainMenu.getByRole('menuitem', { name, exact: true }).click()
  const menu = page.getByRole('menu', { name })
  await expect(menu).toBeVisible()
  return menu
}
