import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const TAB_COUNT = 20

/** Horizontal position of the tab row and whether the active tab and new-tab button are fully shown. */
function tabRowState(page: Page) {
  return page.evaluate(() => {
    const tabBar = document.querySelector('[data-slot="tab-bar"]')
    const scroller = tabBar?.querySelector('[role="tablist"]')?.parentElement
    const active = tabBar?.querySelector('[data-slot="tab-item"][data-active]')
    const newTab = tabBar?.querySelector('[data-test-id="tabbar-new"]')
    if (!scroller || !active || !newTab) throw new Error('Tab bar is missing')
    const row = scroller.getBoundingClientRect()
    const tab = active.getBoundingClientRect()
    const button = newTab.getBoundingClientRect()
    return {
      scrollLeft: Math.round(scroller.scrollLeft),
      maxScrollLeft: scroller.scrollWidth - scroller.clientWidth,
      activeVisible: tab.left >= row.left - 1 && tab.right <= row.right + 1,
      newTabVisible: button.right <= window.innerWidth
    }
  })
}

/** Scroll the tab row to its start and report where it is two frames later. */
function scrollTabsToStart(page: Page) {
  return page.evaluate(async () => {
    const scroller = document
      .querySelector('[data-slot="tab-bar"]')
      ?.querySelector('[role="tablist"]')?.parentElement
    if (!scroller) throw new Error('Tab bar is missing')
    scroller.scrollLeft = 0
    for (let frame = 0; frame < 2; frame++) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }
    return Math.round(scroller.scrollLeft)
  })
}

test('overflowing tabs keep the new-tab button and active tab in view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const newTab = page.getByTestId('tabbar-new')
  for (let count = 1; count < TAB_COUNT; count++) await newTab.click()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(TAB_COUNT)

  await expect
    .poll(() => tabRowState(page))
    .toMatchObject({
      activeVisible: true,
      newTabVisible: true
    })
  const scrolled = await tabRowState(page)
  expect(scrolled.maxScrollLeft).toBeGreaterThan(0)

  // Reaching the first tab must not pull the row back to the active tab.
  expect(await scrollTabsToStart(page)).toBe(0)

  // At the start the chevron points to the hidden tabs on the right and scrolls there.
  const chevron = page.getByTestId('tabbar-scroll')
  await expect(chevron).not.toHaveAttribute('data-start')
  await chevron.click()
  await expect.poll(async () => (await tabRowState(page)).scrollLeft).toBeGreaterThan(0)
})
