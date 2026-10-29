import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { layerDriver } from '#tests/helpers/canvas/layers'

/** A frame with enough children to scroll past its own row, expanded in the layers panel. */
async function scrolledFrame(page: Page) {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const layers = layerDriver(() => page)
  const ids = await layers.frameWithChildren('Pinned frame', 60)
  // Selecting a child expands the frame in the layers panel.
  await layers.select([ids.children[0]])
  await canvas.waitForRender()

  await page.getByTestId('layers-scroll').evaluate((el) => {
    el.scrollTop = 600
  })
  const pinned = page.getByTestId('layers-sticky-row')
  await expect(pinned).toContainText('Pinned frame')
  return { canvas, layers, children: ids.children, pinned }
}

test('right-clicking the pinned frame row opens the layer menu for it', async ({ page }) => {
  const { canvas, pinned } = await scrolledFrame(page)

  await pinned.click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
  // The pinned row stays put and shows the frame selected.
  await expect(pinned.locator('[data-slot="row"]')).toHaveAttribute('data-selected', 'true')
  canvas.assertNoErrors()
})

test('clicking the pinned frame row selects it without moving the list', async ({ page }) => {
  const { canvas, pinned } = await scrolledFrame(page)
  const scroller = page.getByTestId('layers-scroll')
  const before = await scroller.evaluate((el) => el.scrollTop)

  await pinned.click()
  await expect(pinned.locator('[data-slot="row"]')).toHaveAttribute('data-selected', 'true')
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(before)
  canvas.assertNoErrors()
})

test('double-clicking the pinned frame row renames it on its own row', async ({ page }) => {
  const { canvas, pinned } = await scrolledFrame(page)

  await pinned.dblclick()
  const input = page.getByTestId('layers-item-input')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('Pinned frame')
  // The list scrolled back to the frame's row, so nothing is pinned while it is renamed.
  await expect(pinned).toHaveCount(0)
  canvas.assertNoErrors()
})

test("selecting a pinned frame's child scrolls its row into view below the pin", async ({
  page
}) => {
  const { canvas, layers, children, pinned } = await scrolledFrame(page)
  const scroller = page.getByTestId('layers-scroll')
  // Scroll to the end of the list, then select a child further up from outside the panel, as on
  // the canvas: the list scrolls back to it with the frame row pinned above.
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const target = children[30]
  await layers.select([target])

  const row = page.locator(`[data-node-id="${target}"]`).getByTestId('layers-item')
  await expect(row).toBeVisible()
  await expect(pinned).toBeVisible()
  const pinBox = await pinned.boundingBox()
  const rowBox = await row.boundingBox()
  expect(rowBox?.y ?? 0).toBeGreaterThanOrEqual((pinBox?.y ?? 0) + (pinBox?.height ?? 0) - 1)
  canvas.assertNoErrors()
})
