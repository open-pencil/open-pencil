import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { fillDriver } from '#tests/helpers/canvas/fill-driver'

// Figma desktop 126 undoes with a colour picker open; other shortcuts still wait for it to close.

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

const fill = fillDriver(() => page)
const selectedFillColor = () => fill.selectedColor()

async function changeHue() {
  const slider = page
    .getByTestId('color-slider-hue')
    .locator(':scope > [data-orientation="horizontal"]')
  const box = await slider.boundingBox()
  if (!box) throw new Error('Missing hue slider')
  await slider.click({ position: { x: box.width * 0.65, y: box.height / 2 } })
  await canvas.waitForRender()
}

async function openPickerOnNewRect() {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 160, 120)
  await canvas.waitForRender()
  await page.getByTestId('fill-picker-swatch').first().click()
  await expect(page.getByTestId('fill-picker-tab-solid')).toBeVisible()
}

test('Cmd+Z undoes a colour change while the picker stays open', async () => {
  await openPickerOnNewRect()

  const before = await selectedFillColor()
  await changeHue()
  expect(await selectedFillColor()).not.toEqual(before)

  // Pressed at once, before the picker's changes settle into one undo step.
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(selectedFillColor).toEqual(before)
  await expect(page.getByTestId('fill-picker-tab-solid')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(selectedFillColor).not.toEqual(before)
  await expect(page.getByTestId('fill-picker-tab-solid')).toBeVisible()
  canvas.assertNoErrors()
})

test('Cmd+Z undoes the first change of a document with no history', async () => {
  await openPickerOnNewRect()
  await fill.clearHistory()
  const before = await selectedFillColor()
  await changeHue()
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(selectedFillColor).toEqual(before)
})
