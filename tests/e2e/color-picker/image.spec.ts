import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { fillDriver } from '#tests/helpers/canvas/fill-driver'
import { testPath } from '#tests/helpers/paths'
import { propertyItems, propertySection } from '#tests/helpers/properties'

// Escape puts back a colour dragged in the picker, but a new image, scale mode, or turn is a step
// of its own that Escape keeps.

const editor = useEditorSetupWithClear()
const fill = fillDriver(() => editor.page)

const SWATCHES = { fills: 'Fill', strokes: 'Stroke' } as const
type PaintKind = keyof typeof SWATCHES

const picker = () => editor.page.locator('[data-picker-content]')

async function togglePicker(kind: PaintKind) {
  await propertyItems(editor.page, kind)
    .first()
    .getByRole('button', { name: SWATCHES[kind], exact: true })
    .click()
}

/** Gives a new rectangle's fill or stroke an image through its picker and leaves it open. */
async function chooseImage(kind: PaintKind = 'fills') {
  await editor.canvas.drawRect(100, 100, 160, 120)
  if (kind === 'strokes')
    await propertySection(editor.page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await editor.canvas.waitForRender()
  await togglePicker(kind)
  await picker().getByRole('button', { name: 'Image', exact: true }).click()
  const chooser = editor.page.waitForEvent('filechooser')
  await picker().getByRole('button', { name: 'Choose image' }).click()
  await (await chooser).setFiles(testPath('fixtures/vectorize/python_logo.png'))
  await expect.poll(async () => (await fill.selectedPaint(kind))?.imageHash).toBeTruthy()
  return fill.selectedPaint(kind)
}

/** Closing the picker by its swatch keeps what it changed. */
async function reopenPicker() {
  await togglePicker('fills')
  await expect(picker()).toBeHidden()
  await togglePicker('fills')
  await expect(picker()).toBeVisible()
}

async function pressEscape() {
  await editor.page.keyboard.press('Escape')
  await expect(picker()).toBeHidden()
  await editor.canvas.waitForRender()
}

test('Escape after choosing an image keeps the image fill', async () => {
  const image = await chooseImage()
  expect(image).toMatchObject({ type: 'IMAGE' })

  await pressEscape()
  expect(await fill.selectedPaint()).toEqual(image)
  editor.canvas.assertNoErrors()
})

test('Escape after changing the scale mode keeps the new mode', async () => {
  const image = await chooseImage()
  await reopenPicker()
  await picker().getByRole('combobox').click()
  await editor.page.getByRole('option', { name: 'Fit', exact: true }).click()
  await expect.poll(() => fill.selectedPaint()).toMatchObject({ imageScaleMode: 'FIT' })

  await pressEscape()
  expect(await fill.selectedPaint()).toEqual({ ...image, imageScaleMode: 'FIT' })
  editor.canvas.assertNoErrors()
})

test('Escape after turning the image keeps the turn', async () => {
  const image = await chooseImage()
  await reopenPicker()
  await picker().getByRole('button', { name: 'Rotate 90°' }).click()
  await expect.poll(() => fill.selectedPaint()).toMatchObject({ imageRotation: 90 })

  await pressEscape()
  expect(await fill.selectedPaint()).toEqual({ ...image, imageRotation: 90 })
  editor.canvas.assertNoErrors()
})

test('Escape after choosing an image for a stroke keeps the image stroke', async () => {
  const image = await chooseImage('strokes')
  expect(image).toMatchObject({ type: 'IMAGE' })

  await pressEscape()
  expect(await fill.selectedPaint('strokes')).toEqual(image)
  editor.canvas.assertNoErrors()
})
