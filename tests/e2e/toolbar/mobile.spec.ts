import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const animations of ['system', 'off'] as const) {
  test(`mobile toolbar retains keyboard navigation with animations ${animations}`, async ({
    page
  }) => {
    await page.addInitScript((animations) => {
      localStorage.setItem(
        'open-pencil:preferences:v1',
        JSON.stringify({ version: 1, appearance: { animations } })
      )
    }, animations)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const toolbar = page.getByTestId('mobile-toolbar-container')
    await expect(toolbar).toHaveAttribute('role', 'toolbar')
    const tools = page.getByTestId('mobile-toolbar-tools')
    await expect(tools).toBeVisible()
    await page.getByTestId('mobile-toolbar-next').click()
    const edit = page.getByTestId('mobile-toolbar-edit')
    await expect(edit).toBeVisible()
    await expect(tools).toHaveCount(0)
    const first = edit.getByRole('button').first()
    await expect(first).toHaveAttribute('aria-label', /.+/)
    await first.focus()
    await first.press('ArrowRight')
    await expect(edit.getByRole('button').nth(1)).toBeFocused()
    await page.getByTestId('mobile-toolbar-prev').click()
    await expect(tools).toBeVisible()
    await expect(edit).toHaveCount(0)
    await expect(tools.getByRole('button').first()).toHaveAttribute('aria-label', /.+/)
    canvas.assertNoErrors()
  })
}
