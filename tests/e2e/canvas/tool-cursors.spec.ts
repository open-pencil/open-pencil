import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const canvasElement = () => editor.page.getByTestId('canvas-element')
const commentsCapture = () => editor.page.locator('[data-slot="comments-capture"]')

/** The hotspot and fallback after a cursor's image, e.g. `16 16, grab`. */
async function cursorTail(cursor: Promise<string>) {
  const value = await cursor
  return value.slice(value.lastIndexOf(')') + 1).trim()
}

const canvasCursor = () => cursorTail(canvasElement().evaluate((el) => el.style.cursor))

test('the hand closes while it pans and opens again on release', async () => {
  await editor.page.keyboard.press('h')
  expect(await canvasCursor()).toBe('16 16, grab')

  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.move(box.x + 300, box.y + 300)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + 340, box.y + 320, { steps: 4 })
  expect(await canvasCursor()).toBe('16 16, grabbing')

  await editor.page.mouse.up()
  expect(await canvasCursor()).toBe('16 16, grab')
  editor.canvas.assertNoErrors()
})

test('the pen keeps its nib cursor while placing points', async () => {
  await editor.page.keyboard.press('p')
  expect(await canvasCursor()).toBe('4 4, crosshair')
  await editor.canvas.click(200, 200)
  expect(await canvasCursor()).toBe('4 4, crosshair')
  await editor.page.keyboard.press('Escape')
})

test('the pencil points with its tip while drawing', async () => {
  await editor.page.keyboard.press('Shift+KeyP')
  expect(await canvasCursor()).toBe('4 20, crosshair')

  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.move(box.x + 200, box.y + 200)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + 280, box.y + 240, { steps: 4 })
  expect(await canvasCursor()).toBe('4 20, crosshair')
  await editor.page.mouse.up()
  await editor.page.keyboard.press('v')
})

test('the comment tool shows a speech bubble pointing with its tail', async () => {
  await editor.page.keyboard.press('c')
  const cursor = commentsCapture().evaluate((el) => (el as HTMLElement).style.cursor)
  expect(await cursorTail(cursor)).toBe('5 24, crosshair')
  await editor.page.keyboard.press('v')
})
