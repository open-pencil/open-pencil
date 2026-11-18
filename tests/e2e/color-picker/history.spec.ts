import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { fillDriver } from '#tests/helpers/canvas/fill-driver'

// Figma desktop 126 undoes with a colour picker open; other shortcuts still wait for it to close.
// Each press in the picker is one undo step and Escape closes it keeping its changes, except while
// a press is held, when Escape puts back only that press's change and leaves the picker open.

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test')
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

const picker = () => page.locator('[data-picker-content]')

async function hueTrack() {
  const slider = page
    .getByTestId('color-slider-hue')
    .locator(':scope > [data-orientation="horizontal"]')
  const box = await slider.boundingBox()
  if (!box) throw new Error('Missing hue slider')
  return {
    at: (fraction: number) => ({ x: box.x + box.width * fraction, y: box.y + box.height / 2 })
  }
}

/** Presses on the hue slider at `from` and moves to `to`, still holding the button. */
async function pressHue(from: number, to: number) {
  const track = await hueTrack()
  const start = track.at(from)
  const end = track.at(to)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 6 })
}

async function dragHue(from: number, to: number) {
  await pressHue(from, to)
  await page.mouse.up()
  await canvas.waitForRender()
}

async function closeWithEscape() {
  await page.keyboard.press('Escape')
  await expect(picker()).toBeHidden()
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

test('each drag in the picker is one undo step, and Escape keeps them', async () => {
  await openPickerOnNewRect()
  await fill.clearHistory()
  const before = await selectedFillColor()
  await dragHue(0.2, 0.4)
  const first = await selectedFillColor()
  await dragHue(0.4, 0.7)
  const second = await selectedFillColor()
  expect(first).not.toEqual(before)
  expect(second).not.toEqual(first)

  await closeWithEscape()
  expect(await selectedFillColor()).toEqual(second)
  await canvas.undo()
  await expect.poll(selectedFillColor).toEqual(first)
  await canvas.undo()
  await expect.poll(selectedFillColor).toEqual(before)
  canvas.assertNoErrors()
})

test('Escape during a drag puts back only that drag and leaves the picker open', async () => {
  await openPickerOnNewRect()
  await fill.clearHistory()
  const before = await selectedFillColor()
  await dragHue(0.2, 0.4)
  const kept = await selectedFillColor()
  const thumb = page.getByTestId('color-slider-hue').getByRole('slider')
  const hue = async () => Number(await thumb.getAttribute('aria-valuenow'))
  const keptHue = await hue()

  await pressHue(0.4, 0.8)
  expect(await selectedFillColor()).not.toEqual(kept)
  await page.keyboard.press('Escape')
  await expect.poll(selectedFillColor).toEqual(kept)
  // What the press would still change before its release is dropped.
  const track = await hueTrack()
  await page.mouse.move(track.at(0.9).x, track.at(0.9).y, { steps: 3 })
  await page.mouse.up()
  await canvas.waitForRender()
  expect(await selectedFillColor()).toEqual(kept)
  // The slider stops following the pointer, so its thumb stays where the colour is.
  expect(await hue()).toBeCloseTo(keptHue, 6)
  await expect(picker()).toBeVisible()

  await closeWithEscape()
  await canvas.undo()
  await expect.poll(selectedFillColor).toEqual(before)
  canvas.assertNoErrors()
})

test('Escape keeps a paint type chosen in the picker, which undoes as one step', async () => {
  await openPickerOnNewRect()
  await fill.clearHistory()
  await page.getByTestId('fill-picker-tab-gradient').click()
  await expect.poll(async () => (await fill.selectedPaint())?.type).toBe('GRADIENT_LINEAR')

  await closeWithEscape()
  expect((await fill.selectedPaint())?.type).toBe('GRADIENT_LINEAR')
  await canvas.undo()
  await expect.poll(async () => (await fill.selectedPaint())?.type).toBe('SOLID')
  canvas.assertNoErrors()
})
