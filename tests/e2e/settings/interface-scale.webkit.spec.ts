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
  await expect(control).toBeHidden()
}

async function savedLayout(page: Page) {
  const state = await page.context().storageState()
  return (
    state.origins
      .find((entry) => entry.origin === new URL(page.url()).origin)
      // eslint-disable-next-line open-pencil/no-direct-storage-access -- Playwright storage snapshot, not browser storage access.
      ?.localStorage.find((entry) => entry.name === 'open-pencil:editor-layout')?.value
  )
}

async function sidebarWidth(page: Page, side: 'left' | 'right') {
  const panel = page.locator(`[data-panel-id="${side === 'left' ? 'layers' : 'properties'}"]`)
  return panel.evaluate((element) => element.getBoundingClientRect().width)
}

for (const scale of ['110%', '150%']) {
  test(`automatic sidebar constraints at ${scale} do not become saved widths`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const left = await sidebarWidth(page, 'left')
    const right = await sidebarWidth(page, 'right')
    await chooseScale(page, scale)
    await page.setViewportSize({ width: 900, height: 800 })
    const minimum = Math.min(900 * 0.35, (240 * Number.parseInt(scale, 10)) / 100)
    await expect.poll(() => sidebarWidth(page, 'left')).toBeGreaterThan(minimum - 1)
    await expect.poll(() => sidebarWidth(page, 'right')).toBeGreaterThan(minimum - 1)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.reload()
    await canvas.waitForInit()
    await chooseScale(page, '100% (default)')
    await expect.poll(() => sidebarWidth(page, 'left')).toBeCloseTo(left, 0)
    await expect.poll(() => sidebarWidth(page, 'right')).toBeCloseTo(right, 0)
    expect(await savedLayout(page)).toBeUndefined()
  })
}

for (const side of ['left', 'right'] as const) {
  for (const input of ['pointer', 'keyboard'] as const) {
    test(`${input} resizing the ${side} sidebar preserves the opposite preference`, async ({
      page
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/?test')
      const canvas = new CanvasHelper(page)
      await canvas.waitForInit()
      const opposite = side === 'left' ? 'right' : 'left'
      const originalOpposite = await sidebarWidth(page, opposite)
      await chooseScale(page, '125%')
      const before = await sidebarWidth(page, side)
      const handle = page.getByTestId(`${side}-splitter-handle`)
      if (input === 'keyboard') {
        await handle.press(side === 'left' ? 'ArrowRight' : 'ArrowLeft')
      } else {
        await handle.hover()
        const box = await handle.boundingBox()
        if (!box) throw new Error('Sidebar resize handle is not visible')
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + (side === 'left' ? 40 : -40), y, { steps: 5 })
        await page.mouse.up()
      }
      await expect.poll(() => sidebarWidth(page, side)).toBeGreaterThan(before + 20)
      const resized = await sidebarWidth(page, side)
      const saved = await savedLayout(page)
      expect(saved).not.toBeUndefined()
      await page.setViewportSize({ width: 900, height: 800 })
      await expect.poll(() => sidebarWidth(page, opposite)).toBeGreaterThan(299)
      await page.setViewportSize({ width: 1280, height: 800 })
      await chooseScale(page, '150%')
      await page.reload()
      await canvas.waitForInit()
      await chooseScale(page, '125%')
      await expect.poll(() => sidebarWidth(page, side)).toBeCloseTo(resized, 0)
      await chooseScale(page, '100% (default)')
      await expect.poll(() => sidebarWidth(page, opposite)).toBeCloseTo(originalOpposite, 0)
      expect(await savedLayout(page)).toBe(saved)
    })
  }
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
