import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { layerDriver } from '#tests/helpers/canvas/layers'
import { getSelectedNode } from '#tests/helpers/store'

async function chooseScale(page: Page, scale: string) {
  await page.getByTestId('app-settings-trigger').click()
  const control = page.getByRole('combobox', {
    name: 'Interface size',
    exact: true
  })
  await control.click()
  await page.getByRole('option', { name: scale, exact: true }).click()
  await expect(control).toHaveText(scale)
  await page.getByTestId('app-settings-done').click()
}

test('interface size applies immediately and survives reload', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await chooseScale(page, '125%')
  await expect(page.locator('html')).toHaveAttribute('data-interface-scale', '125')
  await page.reload()
  await canvas.waitForInit()
  await expect(page.locator('html')).toHaveAttribute('data-interface-scale', '125')
  await page.getByTestId('app-settings-trigger').click()
  await expect(page.getByRole('combobox', { name: 'Interface size', exact: true })).toHaveText(
    '125%'
  )
  await page.getByTestId('app-settings-done').click()
})

test('interface size can return to the default', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await chooseScale(page, '125%')
  await chooseScale(page, '100% (default)')
  await page.reload()
  await canvas.waitForInit()
  await expect(page.locator('html')).toHaveAttribute('data-interface-scale', '100')
})

for (const scale of ['110%', '125%', '150%']) {
  test(`interface size ${scale} preserves canvas geometry and pointer coordinates`, async ({
    page
  }) => {
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await canvas.drawRect(100, 100, 160, 100)
    const before = await getSelectedNode(page)
    await chooseScale(page, scale)
    expect(await getSelectedNode(page)).toEqual(before)
    await expect(
      page.getByTestId('properties-panel').getByRole('button', { name: '100%', exact: true })
    ).toBeVisible()
    await canvas.pressKey('v')
    await canvas.drag(180, 150, 220, 180)
    const moved = await getSelectedNode(page)
    expect(moved?.x).toBe((before?.x ?? 0) + 40)
    expect(moved?.y).toBe((before?.y ?? 0) + 30)
    expect(moved?.width).toBe(160)
    expect(moved?.height).toBe(100)
    await canvas.undo()
    expect(await getSelectedNode(page)).toEqual(before)
    canvas.assertNoErrors()
  })
}

test('resizing the interface keeps virtualized selection, pinned rows and rename usable', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const layers = layerDriver(() => page)
  const ids = await layers.frameWithChildren('Pinned frame', 60)
  await layers.select([ids.children[0]])
  for (const scale of ['150%', '125%']) {
    await chooseScale(page, scale)
    const scroller = page.getByTestId('layers-scroll')
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    const target = ids.children[30]
    await layers.select([target])
    const row = page.locator(`[data-node-id="${target}"]`).getByTestId('layers-item')
    const pinned = page.getByTestId('layers-sticky-row')
    await expect(row).toBeVisible()
    await expect(pinned).toBeVisible()
    const pinBox = await pinned.boundingBox()
    const rowBox = await row.boundingBox()
    expect(rowBox?.y ?? 0).toBeGreaterThanOrEqual((pinBox?.y ?? 0) + (pinBox?.height ?? 0) - 1)
    await pinned.dblclick()
    await expect(page.getByTestId('layers-item-input')).toBeFocused()
    await page.keyboard.press('Escape')
    await layers.select([ids.children[0]])
  }
  canvas.assertNoErrors()
})
