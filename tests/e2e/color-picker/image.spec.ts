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

/** The adjustment slider labelled `name`: its thumb, and the middle and half-width of its run. */
async function adjustmentSlider(name: string) {
  const thumb = picker().getByRole('slider', { name, exact: true })
  const box = await picker().getByTestId(`fill-picker-${name.toLowerCase()}`).boundingBox()
  if (!box) throw new Error(`No ${name} slider`)
  return { thumb, middle: box.x + box.width / 2, half: box.width / 2, y: box.y + box.height / 2 }
}

async function dragAdjustment(name: string, from: number, to: number) {
  const { middle, half, y } = await adjustmentSlider(name)
  await editor.page.mouse.move(middle + from * half, y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(middle + to * half, y, { steps: 8 })
  await editor.page.mouse.up()
}

test('a drag on an adjustment sets it, and lands on 0 near the middle, in one undo step', async () => {
  await chooseImage()
  await reopenPicker()

  await dragAdjustment('Exposure', 0, 0.58)
  await expect
    .poll(async () => (await fill.selectedPaint())?.filters?.exposure)
    .toBeCloseTo(0.58, 1)

  await dragAdjustment('Exposure', 0.58, 0.03)
  await expect.poll(async () => (await fill.selectedPaint())?.filters?.exposure).toBe(0)

  await editor.canvas.undo()
  await expect
    .poll(async () => (await fill.selectedPaint())?.filters?.exposure)
    .toBeCloseTo(0.58, 1)

  await pressEscape()
  expect((await fill.selectedPaint())?.filters?.exposure).toBeCloseTo(0.58, 1)
  editor.canvas.assertNoErrors()
})

test('arrow keys step an adjustment by a hundredth of what Figma stores, ten with Shift', async () => {
  await chooseImage()
  await reopenPicker()

  const { thumb } = await adjustmentSlider('Contrast')
  await thumb.focus()
  await editor.page.keyboard.press('ArrowRight')
  // Figma stores contrast at 0.3 of the plugin API's value, so a step is 0.01 / 0.3.
  await expect
    .poll(async () => (await fill.selectedPaint())?.filters?.contrast)
    .toBeCloseTo(1 / 30, 4)
  await editor.page.keyboard.press('Shift+ArrowRight')
  await expect
    .poll(async () => (await fill.selectedPaint())?.filters?.contrast)
    .toBeCloseTo(11 / 30, 4)

  await (await adjustmentSlider('Tint')).thumb.focus()
  await editor.page.keyboard.press('ArrowLeft')
  await expect.poll(async () => (await fill.selectedPaint())?.filters?.tint).toBeCloseTo(-0.01, 4)
  editor.canvas.assertNoErrors()
})
