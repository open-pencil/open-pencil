import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test.describe('split canvas views', () => {
  test('splits, resizes, activates, and closes independent canvas views', async ({ page }) => {
    await page.goto('/')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await expect(page.locator('[data-slot="canvas-pane-header"]')).toHaveCount(0)
    await canvas.drawRect(140, 180, 180, 120)

    await page.getByRole('menuitem', { name: 'View', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Split right' }).click()

    const headers = page.locator('[data-slot="canvas-pane-header"]')
    await expect(headers).toHaveCount(2)
    await expect(headers.nth(1)).toHaveAttribute('data-active', 'true')
    await expect(headers.nth(1)).toContainText('Page 1')
    await expect(headers.nth(1)).toContainText('100%')

    const panes = page.locator('[data-active-pane]')
    await expect(panes).toHaveCount(2)
    await expect(panes.nth(1)).toHaveAttribute('data-active-pane', 'true')
    await expect(page.locator('canvas[data-ready="1"]')).toHaveCount(4)

    const firstBox = await panes.nth(0).boundingBox()
    const secondBox = await panes.nth(1).boundingBox()
    expect(firstBox?.width).toBeGreaterThan(300)
    expect(secondBox?.width).toBeGreaterThan(300)

    await panes.nth(0).click({ position: { x: 100, y: 100 } })
    await expect(panes.nth(0)).toHaveAttribute('data-active-pane', 'true')
    await expect(headers.nth(0)).toHaveAttribute('data-active', 'true')

    const handle = page.locator('[data-split-id]').first()
    const handleBox = await handle.boundingBox()
    if (!handleBox) throw new Error('Expected split handle')
    await page.mouse.move(handleBox.x, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2)
    await page.mouse.up()

    const resizedFirstBox = await panes.nth(0).boundingBox()
    const resizedSecondBox = await panes.nth(1).boundingBox()
    expect(resizedFirstBox?.width).toBeGreaterThan(firstBox?.width ?? 0)
    expect(resizedSecondBox?.width).toBeLessThan(secondBox?.width ?? Number.POSITIVE_INFINITY)

    await headers.nth(0).getByRole('button', { name: 'Close view' }).click()
    await expect(panes).toHaveCount(1)
    await expect(headers).toHaveCount(0)
    await expect(page.locator('canvas[data-ready="1"]')).toHaveCount(2)
  })
})
