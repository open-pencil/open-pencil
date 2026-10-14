import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('the boot splash plays the assembling mark in full before the app shows', async ({ page }) => {
  // Automation skips the wait; present this page as a person's browser.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
  })
  await page.goto('/')
  const splash = page.locator('#boot-splash')
  await expect(splash).toBeVisible()
  await expect(splash.locator('svg')).toBeVisible()
  // The app mounts behind the splash; the splash stays until the mark's last animation ends.
  await new CanvasHelper(page).waitForInit()
  const shownFor = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const check = () => {
          if (document.getElementById('boot-splash')) requestAnimationFrame(check)
          else resolve(performance.now())
        }
        check()
      })
  )
  expect(shownFor).toBeGreaterThan(1500)
  await expect(splash).toHaveCount(0)
})

test('automation and test runs skip the wait', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await expect(page.locator('#boot-splash')).toHaveCount(0)
})
