import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId
} from '#tests/helpers/test-ids'

/** The tools the toolbar shows, in order: a flyout counts as the tool its button shows. */
function toolbarOrder(page: Page) {
  return page
    .getByTestId('toolbar')
    .locator('button[aria-pressed]')
    .evaluateAll((buttons) =>
      buttons.flatMap((button) => button.getAttribute('data-test-id') ?? [])
    )
}

test('the toolbar hides, reorders and regroups tools from Settings and keeps the layout', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('toolbar').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Customize toolbar…' }).click()
  const settings = page.getByTestId('settings-toolbar-panel')
  await expect(settings).toBeVisible()

  await settings.getByRole('switch', { name: 'Show Pen', exact: true }).click()
  await settings.getByRole('switch', { name: 'Show Pencil', exact: true }).click()
  // Dropping Comment onto Hand puts both in one menu; Text's grip moves it with the keyboard.
  await settings
    .getByRole('button', { name: 'Reorder Comment' })
    .dragTo(settings.locator('[data-entry="HAND"]'))
  await settings.getByRole('button', { name: 'Reorder Text' }).press('ArrowUp')
  await page.getByTestId('app-settings-done').click()
  await expect(page.getByTestId('app-settings-dialog')).toBeHidden()

  const expectCustomized = async () => {
    await expect(page.getByTestId(toolbarToolTestId('PEN'))).toHaveCount(0)
    await expect(page.getByTestId(toolbarToolTestId('PENCIL'))).toHaveCount(0)
    expect(await toolbarOrder(page)).toEqual(
      (['SELECT', 'FRAME', 'RECTANGLE', 'TEXT', 'HAND'] as const).map((tool) =>
        toolbarToolTestId(tool)
      )
    )
    await page.getByTestId(toolbarFlyoutTestId('HAND')).click()
    await page.getByTestId(toolbarFlyoutItemTestId('COMMENT')).click()
    await expect(page.getByTestId(toolbarToolTestId('COMMENT'))).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  }
  await expectCustomized()

  await page.reload()
  await canvas.waitForInit()
  await expectCustomized()

  await canvas.pressKey('p')
  expect(await page.evaluate(() => window.openPencil?.getStore?.().state.activeTool)).toBe('PEN')

  await page.getByTestId('toolbar').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Customize toolbar…' }).click()
  await page.getByRole('button', { name: 'Reset to default' }).click()
  // Back at the default layout, the section has nothing left to reset.
  await expect(page.getByRole('button', { name: 'Reset to default' })).toHaveCount(0)
  await page.getByTestId('app-settings-done').click()
  await expect(page.getByTestId(toolbarToolTestId('PEN'))).toBeVisible()
  canvas.assertNoErrors()
})

/** Picks a place from the toolbar's context menu: an edge, or an alignment along it. */
async function dockFromMenu(page: Page, group: 'Position' | 'Alignment', name: string) {
  await page.getByTestId('toolbar').click({ button: 'right' })
  await page
    .getByRole('group', { name: group })
    .getByRole('menuitemradio', { name, exact: true })
    .click()
}

test('the toolbar docks to any edge and end from its menu and Settings, and stays there', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const toolbar = page.getByTestId('toolbar')

  await dockFromMenu(page, 'Position', 'Left')
  await expect(toolbar).toHaveAttribute('aria-orientation', 'vertical')
  // Along a vertical edge the alignments read Top, Middle, Bottom.
  await dockFromMenu(page, 'Alignment', 'Top')

  const expectTopLeft = async () => {
    const bar = await toolbar.boundingBox()
    const viewport = page.viewportSize()
    if (!bar || !viewport) throw new Error('toolbar is not laid out')
    expect(bar.height).toBeGreaterThan(bar.width)
    expect(bar.x + bar.width).toBeLessThan(viewport.width / 2)
    expect(bar.y).toBeLessThan(viewport.height / 3)
    // The shapes menu opens toward the canvas, to the right of its trigger.
    const trigger = page.getByTestId(toolbarFlyoutTestId('RECTANGLE'))
    await trigger.click()
    const item = await page.getByTestId(toolbarFlyoutItemTestId('ELLIPSE')).boundingBox()
    const triggerBox = await trigger.boundingBox()
    if (!item || !triggerBox) throw new Error('flyout is not laid out')
    expect(item.x).toBeGreaterThanOrEqual(triggerBox.x + triggerBox.width)
    await page.keyboard.press('Escape')
  }
  await expectTopLeft()

  await page.reload()
  await canvas.waitForInit()
  await expectTopLeft()

  await toolbar.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Customize toolbar…' }).click()
  const position = page.getByTestId('settings-toolbar-position')
  const alignment = page.getByTestId('settings-toolbar-alignment')
  await expect(position.getByRole('button', { name: 'Left' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(alignment.getByRole('button', { name: 'Top' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await position.getByRole('button', { name: 'Top' }).click()
  // Along a horizontal edge the same alignment reads Left.
  await expect(alignment.getByRole('button', { name: 'Left' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await page.getByRole('button', { name: 'Reset to default' }).click()
  await expect(alignment.getByRole('button', { name: 'Center' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await page.getByTestId('app-settings-done').click()
  await expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal')
  canvas.assertNoErrors()
})
