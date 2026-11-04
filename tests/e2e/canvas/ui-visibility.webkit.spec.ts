import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { readScenePixels } from '#tests/helpers/canvas/pixels'
import {
  observeCanvasContinuity,
  readCanvasPosition,
  readCanvasNavigation,
  readCanvasWorldPoint,
  waitForIdleCanvas
} from '#tests/helpers/canvas/ui-visibility'

test('Toggle UI reveals the canvas without moving or redrawing the scene', async ({ page }) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.drawRect(440, 180, 160, 120)
  await page.keyboard.press('Escape')
  await page.mouse.move(640, 100)
  await canvas.waitForRender()
  const pixels = await readScenePixels(page, [
    { x: 460, y: 200 },
    { x: 420, y: 160 }
  ])
  expect(pixels[0]).not.toEqual(pixels[1])
  await waitForIdleCanvas(page)
  const box = await canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas missing')
  const clip = { x: box.x + 420, y: box.y + 160, width: 200, height: 160 }
  const artwork = await page.screenshot({ clip })
  const before = await readCanvasPosition(page)
  const continuity = await observeCanvasContinuity(page)
  try {
    for (let cycle = 0; cycle < 4; cycle++) {
      await page.keyboard.press('Meta+Backslash')
      await expect(page.getByTestId('left-splitter-handle')).toBeHidden()
      await expect.poll(() => readCanvasPosition(page)).toEqual(before)
      expect(await page.screenshot({ clip })).toEqual(artwork)
      await page.keyboard.press('Meta+Backslash')
      await expect(page.getByTestId('left-splitter-handle')).toBeVisible()
      await expect.poll(() => readCanvasPosition(page)).toEqual(before)
    }
    expect(await continuity.evaluate((probe) => probe.read())).toEqual({
      connected: true,
      sameRenderers: true,
      sceneFrames: 0,
      replacements: 0
    })
  } finally {
    await continuity.evaluate((probe) => probe.restore())
    await continuity.dispose()
  }
  canvas.assertNoErrors()
})

test('rulers and zoom to selection follow the visible area between panels', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const handle = page.getByTestId('left-splitter-handle')
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await canvas.drawRect(440, 180, 160, 120)
  await page.keyboard.press('Shift+2')
  await waitForIdleCanvas(page)
  const area = await canvas.canvas.boundingBox()
  const visible = await page.locator('[data-panel-id="canvas"]').boundingBox()
  if (!area || !visible) throw new Error('Canvas missing')
  const selected = (await readCanvasNavigation(page)).selection
  expect(selected).not.toBeNull()
  expect((selected?.x ?? 0) + area.x).toBeGreaterThan(visible.x)
  expect((selected?.x ?? 0) + (selected?.width ?? 0) + area.x).toBeLessThan(
    visible.x + visible.width
  )
  await page.mouse.move(0, 0)
  await expect(canvas.canvas).toHaveScreenshot('rulers-between-panels.png')
  const before = await readCanvasPosition(page)
  await page.keyboard.press('Meta+Backslash')
  await expect(handle).toBeHidden()
  expect(await readCanvasPosition(page)).toEqual(before)
  await expect(canvas.canvas).toHaveScreenshot('rulers-without-panels.png')
  await page.keyboard.press('Meta+Backslash')
  await expect(handle).toBeVisible()
  // Drag a vertical guide out of the ruler beside the sidebar, whose canvas origin is nonzero.
  await page.mouse.move(visible.x + 10, area.y + 220)
  await page.mouse.down()
  await page.mouse.move(visible.x + 120, area.y + 220, { steps: 6 })
  await page.mouse.up()
  await expect
    .poll(async () => (await readCanvasNavigation(page)).guide)
    .toEqual({ axis: 'x', screenPosition: visible.x + 120 - area.x })
  canvas.assertNoErrors()
})

test('split views and custom sidebar widths survive UI toggles', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const handle = page.getByTestId('left-splitter-handle')
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  const sidebar = await handle.boundingBox()
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Split right' }).click()
  await expect(page.locator('canvas[data-ready="1"]')).toHaveCount(4)
  await waitForIdleCanvas(page)
  const before = await readCanvasPosition(page)
  const continuity = await observeCanvasContinuity(page)
  try {
    await page.keyboard.press('Meta+Backslash')
    await expect(page.locator('[data-slot="canvas-pane-header"]')).toHaveCount(0)
    expect(await readCanvasPosition(page)).toEqual(before)
    await page.keyboard.press('Meta+Backslash')
    await expect(page.locator('[data-slot="canvas-pane-header"]')).toHaveCount(2)
    expect(await readCanvasPosition(page)).toEqual(before)
    expect(await handle.boundingBox()).toEqual(sidebar)
    expect(await continuity.evaluate((probe) => probe.read())).toMatchObject({
      connected: true,
      sameRenderers: true,
      replacements: 0
    })
  } finally {
    await continuity.evaluate((probe) => probe.restore())
    await continuity.dispose()
  }
  canvas.assertNoErrors()
})

test('keyboard and menu zoom keep the visible canvas centre fixed', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.getByTestId('left-splitter-handle').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  const area = await canvas.canvas.boundingBox()
  const visible = await page.locator('[data-panel-id="canvas"]').boundingBox()
  if (!area || !visible) throw new Error('Canvas missing')
  const centre = {
    x: visible.x + visible.width / 2 - area.x,
    y: visible.y + visible.height / 2 - area.y
  }
  const point = await readCanvasWorldPoint(page, centre)
  const before = await readCanvasPosition(page)
  await page.keyboard.press('Meta+Equal')
  const zoomed = await readCanvasPosition(page)
  expect(zoomed.zoom).toBeGreaterThan(before.zoom)
  expect(await readCanvasWorldPoint(page, centre)).toEqual(point)

  await page
    .getByTestId('properties-panel')
    .getByRole('button', { name: /^\d+%$/ })
    .click()
  await page.getByRole('menuitem', { name: /^Zoom out/ }).click()
  const after = await readCanvasWorldPoint(page, centre)
  expect(after.x).toBeCloseTo(point.x)
  expect(after.y).toBeCloseTo(point.y)
  expect((await readCanvasPosition(page)).zoom).toBeLessThan(zoomed.zoom)
  canvas.assertNoErrors()
})
