import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test.describe('split canvas views', () => {
  test('splits, resizes, activates, and closes independent canvas views', async ({ page }) => {
    await page.goto('/?test')
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

    // Each header shows its view's zoom and opens the zoom menu for that view.
    const zooms = headers.getByTestId('zoom-dropdown-trigger')
    await expect(zooms.nth(0)).toHaveText(await zooms.nth(1).innerText())
    await page.keyboard.press('ControlOrMeta+=')
    await expect(zooms.nth(0)).not.toHaveText(await zooms.nth(1).innerText())
    await zooms.nth(1).click()
    await page.getByRole('menuitem', { name: 'Zoom to 50%' }).click()
    await expect(zooms.nth(1)).toHaveText('50%')
    await expect(headers.nth(1)).toHaveAttribute('data-active', 'true')
    await expect(zooms.nth(0)).not.toHaveText('50%')

    await headers.nth(0).getByRole('button', { name: 'Close view' }).click()
    await expect(panes).toHaveCount(1)
    await expect(headers).toHaveCount(0)
    await expect(page.locator('canvas[data-ready="1"]')).toHaveCount(2)
  })

  test('Shift+Cmd+Backslash splits the active view right', async ({ page }) => {
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const panes = page.locator('[data-active-pane]')

    await page.keyboard.press('ControlOrMeta+Shift+Backslash')
    await expect(panes).toHaveCount(2)
    await expect(panes.nth(1)).toHaveAttribute('data-active-pane', 'true')
    await expect(page.getByTestId('layers-panel')).toBeVisible()
    canvas.assertNoErrors()
  })

  // Split view keeps the panels, so the previewing view's header says it and leaves it.
  test('previews the active view and shows it in that view header', async ({ page }) => {
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await page.keyboard.press('ControlOrMeta+Shift+Backslash')
    const headers = page.locator('[data-slot="canvas-pane-header"]')
    const play = page.getByTestId('editor-start-preview')

    await play.click()
    await expect(play).toHaveAttribute('aria-pressed', 'true')
    await expect(headers.nth(1).getByTestId('pane-previewing')).toBeVisible()
    await expect(headers.nth(0).getByTestId('pane-previewing')).toHaveCount(0)

    await headers.nth(1).getByTestId('pane-leave-preview').click()
    await expect(headers.getByTestId('pane-previewing')).toHaveCount(0)
    await expect(play).toHaveAttribute('aria-pressed', 'false')

    await play.click()
    await play.click()
    await expect(headers.getByTestId('pane-previewing')).toHaveCount(0)
    canvas.assertNoErrors()
  })

  test('keeps both views on screen while the editor UI is hidden', async ({ page }) => {
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await page.getByRole('menuitem', { name: 'View', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Split right' }).click()
    const surfaces = page.locator('canvas[data-ready="1"]')
    await expect(surfaces).toHaveCount(4)
    await surfaces.evaluateAll((elements) => {
      for (const surface of elements) surface.setAttribute('data-test-kept', '')
    })
    const kept = page.locator('canvas[data-ready="1"][data-test-kept]')
    const panes = page.locator('[data-active-pane]')
    const headers = page.locator('[data-slot="canvas-pane-header"]')

    await page.keyboard.press('Meta+\\')
    await expect(page.getByTestId('layers-panel')).not.toBeVisible()
    await expect(panes).toHaveCount(2)
    await expect(surfaces).toHaveCount(4)
    await expect(kept).toHaveCount(4)
    await expect(headers).toHaveCount(0)

    await page.keyboard.press('Meta+\\')
    await expect(page.getByTestId('layers-panel')).toBeVisible()
    await expect(headers).toHaveCount(2)
    await expect(surfaces).toHaveCount(4)
    await expect(kept).toHaveCount(4)
    canvas.assertNoErrors()
  })
})
