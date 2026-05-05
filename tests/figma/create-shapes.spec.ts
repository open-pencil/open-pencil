import { test, expect } from '@playwright/test'

import { FigmaHelper } from '#tests/helpers/figma'

test.describe('figma reference: create shapes', () => {
  let figma: FigmaHelper

  test.beforeAll(async () => {
    figma = new FigmaHelper()
    await figma.connect()
  })

  test.afterAll(async () => {
    await figma.disconnect()
  })

  test.beforeEach(async () => {
    await figma.deleteSelection()
    await figma.waitForRender()
  })

  test('empty canvas', async () => {
    await expect(figma.canvas).toHaveScreenshot()
  })

  test('draw rectangle', async () => {
    await figma.drawRect(200, 200, 200, 150)
    await expect(figma.canvas).toHaveScreenshot()
  })
})
