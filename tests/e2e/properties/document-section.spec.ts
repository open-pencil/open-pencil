import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import {
  documentProfileState,
  resetDocumentProfile
} from '#tests/helpers/canvas/color-space/driver'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

const profileSelect = () =>
  propertySection(editor.page, 'Document').getByRole('combobox', { name: 'Color profile' })

async function chooseProfile(name: string) {
  await profileSelect().click()
  await editor.page.getByRole('option', { name, exact: true }).click()
  return editor.page.getByRole('alertdialog')
}

test.beforeEach(async () => {
  await resetDocumentProfile(editor.page, { r: 0.2, g: 0.4, b: 0.6, a: 1 })
})

test('choosing a color profile asks how, and Cancel keeps the profile', async () => {
  const dialog = await chooseProfile('Display P3')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  expect((await documentProfileState(editor.page)).space).toBe('srgb')
  await expect(profileSelect()).toHaveText('sRGB')
})

test('Assign keeps the values, and one undo puts the profile back', async () => {
  const dialog = await chooseProfile('Display P3')
  await dialog.getByRole('button', { name: 'Assign' }).click()
  const assigned = await documentProfileState(editor.page)
  expect(assigned.space).toBe('display-p3')
  expect(assigned.pageColor.b).toBeCloseTo(0.6, 5)

  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await documentProfileState(editor.page)).space).toBe('srgb')
})

test('Convert rewrites the values to keep the colors, and one undo puts them back', async () => {
  const dialog = await chooseProfile('Display P3')
  await dialog.getByRole('button', { name: 'Convert' }).click()
  const converted = await documentProfileState(editor.page)
  expect(converted.space).toBe('display-p3')
  // The same blue takes less of P3's wider blue primary.
  expect(converted.pageColor.b).toBeLessThan(0.6)

  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await documentProfileState(editor.page)).space).toBe('srgb')
  expect((await documentProfileState(editor.page)).pageColor.b).toBeCloseTo(0.6, 5)
  editor.canvas.assertNoErrors()
})
