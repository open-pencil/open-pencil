import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { sectionClicksDriver } from '#tests/helpers/canvas/section-clicks/driver'

// Each case repeats a click in Figma desktop 126 on a section holding two frames.

let scene: ReturnType<typeof sectionClicksDriver>
let canvas: CanvasHelper

test.beforeEach(async ({ page }) => {
  await page.goto('/?test')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  scene = sectionClicksDriver(() => page)
  await scene.build()
})

test('a click on a section’s empty area selects it, a drag there marquee-selects inside it', async () => {
  await canvas.click(750, 450)
  await expect.poll(() => scene.selection()).toEqual(['Section'])
  await scene.clearSelection()
  await canvas.drag(80, 100, 550, 300)
  await expect.poll(() => scene.selection()).toEqual(['Empty', 'Full'])
})

test('a right-click selects the frame or section whose empty area is under it', async ({
  page
}) => {
  const clicked = scene
  for (const [x, y, name] of [
    [450, 180, 'Full'],
    [150, 155, 'Empty'],
    [700, 400, 'Section']
  ] as const) {
    await clicked.clearSelection()
    const point = await clicked.point(x, y)
    await page.mouse.click(point.x, point.y, { button: 'right' })
    await expect.poll(() => clicked.selection()).toEqual([name])
    await page.keyboard.press('Escape')
  }
})

test('a swatch reached by double-clicks, then clicks on other rows and sections, as in Figma', async () => {
  const ids = await scene.buildSwatchRows()
  await canvas.waitForRender()
  const swatch = await scene.center(ids.lightSwatch)
  const other = await scene.center(ids.lightRowTwoSwatch)
  const dark = await scene.center(ids.darkSwatch)

  // A click from nothing selects the row, the direct child of the section's top-level frame.
  await canvas.click(swatch.x, swatch.y)
  await expect.poll(() => scene.selection()).toEqual(['Light Row 1'])
  await canvas.dblclick(swatch.x, swatch.y)
  await expect.poll(() => scene.selection()).toEqual(['Card 2'])
  await canvas.dblclick(swatch.x, swatch.y)
  await expect.poll(() => scene.selection()).toEqual(['Light Row 1 Card 2'])
  expect(await scene.entered()).toBe('Card 2')

  // A swatch in another row selects that row, however deep the selection was.
  await canvas.click(other.x, other.y)
  await expect.poll(() => scene.selection()).toEqual(['Light Row 2'])
  expect(await scene.entered()).toBeNull()
  // A swatch in another section selects its row.
  await canvas.click(dark.x, dark.y)
  await expect.poll(() => scene.selection()).toEqual(['Dark Row 2'])
  await canvas.dblclick(dark.x, dark.y)
  await canvas.dblclick(dark.x, dark.y)
  await expect.poll(() => scene.selection()).toEqual(['Dark Row 2 Card 1'])

  // The page between the sections deselects and leaves every entered container.
  await canvas.click(swatch.x, 330)
  await expect.poll(() => scene.selection()).toEqual([])
  expect(await scene.entered()).toBeNull()
  canvas.assertNoErrors()
})

test('a section’s empty area deselects a selection and is selected only from nothing', async () => {
  const ids = await scene.buildSwatchRows()
  await canvas.waitForRender()
  const swatch = await scene.center(ids.lightSwatch)
  await canvas.click(swatch.x, swatch.y)
  await canvas.dblclick(swatch.x, swatch.y)
  await expect.poll(() => scene.selection()).toEqual(['Card 2'])

  // The section's padding below its rows.
  await canvas.click(70, 300)
  await expect.poll(() => scene.selection()).toEqual([])
  await canvas.click(70, 300)
  await expect.poll(() => scene.selection()).toEqual(['Light'])
  canvas.assertNoErrors()
})
