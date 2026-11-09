import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { panelDecimalsDriver } from '#tests/helpers/canvas/panel-decimals/driver'
import { propertyField } from '#tests/helpers/properties'
import { getNodeById } from '#tests/helpers/store'

// Figma desktop (2026-11-08) shows X, Y, W, H, rotation, padding, and gap to two decimals, both
// at rest and while a field is edited; the layer keeps its exact value.
const editor = useEditorSetupWithClear('/?test')
const scene = panelDecimalsDriver(() => editor.page)

const field = (name: string) => editor.page.getByRole('spinbutton', { name, exact: true })

test.beforeEach(async () => {
  await scene.build()
})

test('position and size fields show two decimals', async () => {
  await scene.select((ids) => ids.measured)
  await expect(field('X Axis')).toHaveAttribute('aria-valuenow', '100.38')
  await expect(field('Width')).toHaveAttribute('aria-valuenow', '151.25')
  await expect(field('Height')).toHaveAttribute('aria-valuenow', '33.33')

  await field('Width').focus()
  await expect(field('Width')).toHaveValue('151.25')
  await field('Width').press('Escape')

  await scene.select((ids) => ids.turned)
  await expect(field('Rotation')).toHaveAttribute('aria-valuenow', /^-?30\.13$/)
  editor.canvas.assertNoErrors()
})

test('a field left as it began keeps the layer’s exact value', async () => {
  await scene.select((ids) => ids.measured)
  const ids = await scene.ids()
  await field('Height').focus()
  await expect(field('Height')).toHaveValue('33.33')
  await field('Height').press('Enter')
  await editor.canvas.waitForRender()
  expect((await getNodeById(editor.page, ids.measured))?.height).toBe(33.333333)
  editor.canvas.assertNoErrors()
})

test('padding and gap show two decimals', async () => {
  await scene.select((ids) => ids.padded)
  await expect(propertyField(editor.page, 'paddingLeft')).toHaveAttribute('aria-valuenow', '10.5')
  await expect(propertyField(editor.page, 'paddingTop')).toHaveAttribute('aria-valuenow', '3.33')
  await expect(propertyField(editor.page, 'itemSpacing')).toHaveAttribute('aria-valuenow', '7.75')
  editor.canvas.assertNoErrors()
})

test('a new variable is offered with the value it will hold', async () => {
  await scene.select((ids) => ids.padded)
  await propertyField(editor.page, 'paddingLeft').getByLabel('Apply variable').click()
  // The offer names the value the variable will hold, whatever its wording.
  await editor.page.getByRole('button', { name: /(^|\s)10\.5$/ }).click()
  await editor.page.getByRole('textbox').last().fill('Padding/side')
  await editor.page.getByRole('textbox').last().press('Enter')
  await editor.canvas.waitForRender()
  expect(await scene.boundValue((ids) => ids.padded, 'paddingLeft')).toBe(10.5)
  editor.canvas.assertNoErrors()
})

test('a multi-selection shows its shared size to two decimals', async () => {
  await scene.select((ids) => ids.thirds)
  await expect(field('Width')).toHaveAttribute('aria-valuenow', '33.33')
  editor.canvas.assertNoErrors()
})
