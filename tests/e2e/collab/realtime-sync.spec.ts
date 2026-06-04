import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { getNodeById, getPageChildren } from '#tests/helpers/store'

test('board room syncs shape movement between two tabs in realtime', async ({ browser, page }) => {
  const boardName = `Realtime ${Date.now()}`

  await page.goto('/boards')
  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()
  await expect(page.getByTestId('editor-root')).toBeVisible()

  const secondContext = await browser.newContext()
  const secondPage = await secondContext.newPage()
  await secondPage.goto(page.url())
  await expect(secondPage.getByTestId('editor-root')).toBeVisible()

  const firstCanvas = new CanvasHelper(page)
  const secondCanvas = new CanvasHelper(secondPage)
  await Promise.all([firstCanvas.waitForInit(), secondCanvas.waitForInit()])

  await firstCanvas.drawRect(120, 120, 120, 80)
  const rectangle = (await getPageChildren(page)).find((node) => node.type === 'RECTANGLE')
  expect(rectangle).toBeTruthy()
  if (!rectangle) throw new Error('Expected rectangle to be created')

  await expect
    .poll(async () => (await getNodeById(secondPage, rectangle.id))?.x ?? null)
    .toBe(rectangle.x)

  await firstCanvas.selectTool('select')
  await firstCanvas.drag(rectangle.x + 20, rectangle.y + 20, rectangle.x + 160, rectangle.y + 60)

  await expect
    .poll(async () => (await getNodeById(secondPage, rectangle.id))?.x ?? null)
    .toBeGreaterThan(rectangle.x + 40)

  await secondContext.close()
})
