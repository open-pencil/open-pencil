import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { fillDriver } from '#tests/helpers/canvas/fill-driver'

// A shader's colour is edited in a picker opened from the fill picker; a drag there is one undo
// step, as any other drag in a picker is.

const editor = useEditorSetupWithClear()
const fill = fillDriver(() => editor.page)

async function expandSettings() {
  await editor.page
    .locator('[data-picker-content]')
    .getByRole('button', { name: 'Expand effect settings' })
    .click()
}

async function reopen() {
  await editor.page.getByTestId('fill-picker-swatch').first().click()
  await expandSettings()
}

test('a drag in a shader colour’s picker is one undo step', async () => {
  await editor.canvas.drawRect(100, 100, 160, 120)
  await editor.canvas.waitForRender()
  await editor.page.getByTestId('fill-picker-swatch').first().click()
  await editor.page.getByTestId('fill-picker-tab-shader').click()
  await expandSettings()
  await editor.canvas.clearHistory()

  // The first colour setting of the shader's effect, read from its hex as the panel shows it.
  const setting = editor.page
    .locator('[data-picker-content] [data-property^="shader-"]')
    .filter({ has: editor.page.getByTestId('color-hex-input') })
    .first()
  const hex = () => setting.getByTestId('color-hex-input').inputValue()
  const before = await hex()

  await setting.getByRole('button', { name: 'Edit color' }).click()
  const area = editor.page.locator('[data-picker-content] .cursor-crosshair').last()
  const box = await area.boundingBox()
  if (!box) throw new Error('Missing colour area')
  await editor.page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 8 })
  await editor.page.mouse.up()
  await expect.poll(hex).not.toBe(before)
  const dragged = await hex()

  // Escape closes the colour's picker, then the fill picker, keeping the colour.
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Escape')
  await expect(editor.page.locator('[data-picker-content]')).toHaveCount(0)
  await reopen()
  await expect.poll(hex).toBe(dragged)
  await editor.page.keyboard.press('Escape')

  await editor.canvas.undo()
  await reopen()
  await expect.poll(hex).toBe(before)
  editor.canvas.assertNoErrors()
})

test('leaving a shader for Image or Solid stops drawing it', async () => {
  await editor.canvas.drawRect(100, 100, 160, 120)
  await editor.canvas.waitForRender()
  const page = editor.page
  const tab = (name: string) => page.getByTestId(`fill-picker-tab-${name}`)
  const paint = () => fill.selectedPaint()
  await page.getByTestId('fill-picker-swatch').first().click()

  await tab('shader').click()
  await expect(page.getByTestId('shader-fill-picker')).toBeVisible()
  await tab('image').click()
  await expect(page.getByTestId('fill-picker-image-well')).toBeVisible()
  await expect(page.getByTestId('shader-fill-picker')).toHaveCount(0)
  await expect.poll(async () => (await paint())?.imageHash).toBeUndefined()

  await tab('shader').click()
  await tab('solid').click()
  await expect.poll(async () => (await paint())?.type).toBe('SOLID')
  await tab('image').click()
  await expect(page.getByTestId('fill-picker-image-well')).toBeVisible()
  await expect(page.getByTestId('shader-fill-picker')).toHaveCount(0)
  editor.canvas.assertNoErrors()
})
