import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyItems, propertySection } from '#tests/helpers/properties'

async function selectedStroke(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    return store.graph.getNode(id)?.strokes?.[0] ?? null
  })
}

/** Until the stroke panel opened the fill picker, a stroke could only ever be one flat color. */
test('a stroke can be made a gradient and taken back to solid', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/')
  await canvas.waitForInit()

  await canvas.drawRect(120, 120, 180, 120)
  await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await canvas.waitForRender()
  expect(await selectedStroke(page)).toMatchObject({ type: 'SOLID' })

  await propertyItems(page, 'strokes')
    .first()
    .getByRole('button', { name: 'Stroke', exact: true })
    .click()
  await expect(page.getByTestId('fill-picker-tab-gradient')).toBeVisible()

  await page.getByTestId('fill-picker-tab-gradient').click()
  await canvas.waitForRender()

  const gradient = await selectedStroke(page)
  expect(gradient?.type).toBe('GRADIENT_LINEAR')
  expect(gradient?.gradientStops?.length).toBeGreaterThan(1)
  // The stroke keeps its geometry across the paint change.
  expect(gradient).toMatchObject({ weight: 1, align: 'INSIDE' })

  await page.getByTestId('fill-picker-tab-solid').click()
  await canvas.waitForRender()

  // Switching back keeps the stops, as it does for a fill, so the gradient returns on re-pick.
  const solid = await selectedStroke(page)
  expect(solid?.type).toBe('SOLID')
  expect(solid).toMatchObject({ weight: 1, align: 'INSIDE' })
  canvas.assertNoErrors()
})
