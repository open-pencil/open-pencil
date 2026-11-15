import { expect, test, type Page } from '@playwright/test'

async function openStory(page: Page, story: 'default' | 'draw-only') {
  await page.goto(`/iframe.html?id=vue-sdk-canvas-canvas-root--${story}&viewMode=story`)
  const canvas = page.locator('canvas')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  return canvas
}

/** The card's and the title's centers on the canvas, where the example places them. */
const CARD = { x: 300, y: 200 }
const TITLE = { x: 240, y: 72 }

test('CanvasRoot starts CanvasKit for the CanvasSurface inside it', async ({ page }) => {
  const canvas = await openStory(page, 'default')
  // A canvas keeps its 300×150 default until CanvasKit creates a surface at its CSS size.
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.width)).toBe(600)
  await expect(page.getByTestId('status')).toHaveText('Started')
})

test('CanvasRoot takes pointer input: a click selects the card and a drag moves it', async ({
  page
}) => {
  const canvas = await openStory(page, 'default')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Expected the canvas on the page')
  await page.mouse.click(box.x + CARD.x, box.y + CARD.y)
  await expect(page.getByTestId('selection')).toHaveText('Card')
  await expect(canvas).toHaveCSS('cursor', 'default')

  await page.mouse.move(box.x + CARD.x, box.y + CARD.y)
  await page.mouse.down()
  await page.mouse.move(box.x + CARD.x + 40, box.y + CARD.y + 20, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByTestId('card')).toHaveText('Card at 260,170')
})

test('CanvasRoot takes typing: a double-click edits the title and keys change it', async ({
  page
}) => {
  const canvas = await openStory(page, 'default')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Expected the canvas on the page')
  await page.mouse.dblclick(box.x + TITLE.x, box.y + TITLE.y)
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('Bye')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('title')).toHaveText('Title reads Bye')
})

test('CanvasRoot with input off only draws', async ({ page }) => {
  const canvas = await openStory(page, 'draw-only')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Expected the canvas on the page')
  await page.mouse.click(box.x + CARD.x, box.y + CARD.y)
  await expect(page.getByTestId('selection')).toHaveText('Nothing selected')

  await page.mouse.move(box.x + CARD.x, box.y + CARD.y)
  await page.mouse.down()
  await page.mouse.move(box.x + CARD.x + 40, box.y + CARD.y + 20, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByTestId('card')).toHaveText('Card at 220,150')
})
