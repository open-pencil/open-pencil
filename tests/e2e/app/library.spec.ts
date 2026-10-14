import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await new CanvasHelper(page).waitForInit()
})

test('an edited design saves itself, closes without asking, and reopens from the start page', async ({
  page
}) => {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    store.createShape('RECTANGLE', 100, 100, 100, 100)
    store.renameDocument('Library card')
  })
  await page.getByTestId('tabbar-close').click()

  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  const home = page.getByTestId('recent-files-home')
  await expect(home).toBeVisible()
  await expect(home.getByTestId('home-library-location')).toHaveText('Saved on this device')
  await home.getByRole('button', { name: /Library card/ }).click()

  await expect(page.getByTestId('tabbar-tab')).toContainText('Library card')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...(window.openPencil?.getStore?.().graph.nodes.values() ?? [])].filter(
            (node) => node.type === 'RECTANGLE'
          ).length
      )
    )
    .toBe(1)
})

test('double-clicking a tab renames its design', async ({ page }) => {
  await page.getByTestId('tabbar-tab').dblclick()
  const input = page.getByTestId('tabbar-rename')
  await expect(input).toBeFocused()
  await input.fill('Brand board')
  await input.press('Enter')

  await expect(page.getByTestId('tabbar-tab')).toContainText('Brand board')
  await page.getByTestId('tabbar-home').click()
  await expect(
    page.getByTestId('recent-files-home').getByRole('button', { name: /Brand board/ })
  ).toBeVisible()
})

test('the trash restores designs and permanently deletes them after a warning', async ({
  page
}) => {
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    store.createShape('RECTANGLE', 100, 100, 100, 100)
    store.renameDocument('Trash me')
    await store.persistNow()
  })
  await page.getByTestId('tabbar-home').click()
  const home = page.getByTestId('recent-files-home')
  const card = home.getByRole('button', { name: /Trash me/ })

  // Moving an open design to the trash closes its tab.
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Move to trash' }).click()
  await expect(card).toBeHidden()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(0)

  await home.getByTestId('home-trash').click()
  await expect(home.getByRole('heading', { name: 'Trash' })).toBeVisible()
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Restore' }).click()
  await expect(home.getByText('Trash is empty')).toBeVisible()

  await home.getByTestId('home-trash-back').click()
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Move to trash' }).click()
  await home.getByTestId('home-trash').click()
  await home.getByTestId('home-empty-trash').click()
  const warning = page.getByRole('alertdialog', { name: 'Empty trash?' })
  await expect(warning).toContainText('This can’t be undone.')
  await warning.getByRole('button', { name: 'Permanently delete' }).click()
  await expect(home.getByText('Trash is empty')).toBeVisible()
  await home.getByTestId('home-trash-back').click()
  await expect(card).toBeHidden()
})
