import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// A shader's colour is edited in a picker opened from the fill picker; a drag there is one undo
// step, as any other drag in a picker is.

const editor = useEditorSetupWithClear()

/** How many steps Undo can take back. */
function undoSteps() {
  return editor.page.evaluate(() => {
    const undo = window.openPencil?.getStore?.().undo
    let depth = 0
    while (undo?.peekUndo(depth)) depth++
    return depth
  })
}

test('a drag in a shader colour’s picker is one undo step', async () => {
  await editor.canvas.drawRect(100, 100, 160, 120)
  await editor.canvas.waitForRender()
  await editor.page.getByTestId('fill-picker-swatch').first().click()
  await editor.page.getByTestId('fill-picker-tab-shader').click()
  await editor.page
    .locator('[data-picker-content]')
    .getByRole('button', { name: 'Expand effect settings' })
    .click()
  await editor.canvas.clearHistory()

  const colour = editor.page.locator('[data-picker-content] [data-property^="shader-"]').filter({
    has: editor.page.getByRole('button', { name: 'Edit color' })
  })
  await colour.first().getByRole('button', { name: 'Edit color' }).click()
  const area = editor.page.locator('[data-picker-content] .cursor-crosshair').last()
  const box = await area.boundingBox()
  if (!box) throw new Error('Missing colour area')
  await editor.page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 8 })
  await editor.page.mouse.up()

  expect(await undoSteps()).toBe(1)
  editor.canvas.assertNoErrors()
})
