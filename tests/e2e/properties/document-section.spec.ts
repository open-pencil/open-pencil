import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

function documentState() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return { space: store.state.documentColorSpace, page: store.state.pageColor }
  })
}

async function chooseProfile(name: string) {
  const section = propertySection(editor.page, 'Document')
  await section.getByRole('combobox', { name: 'Color profile' }).click()
  await editor.page.getByRole('option', { name, exact: true }).click()
  return editor.page.getByRole('alertdialog')
}

test.beforeEach(async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.setDocumentColorSpace('srgb')
    store.setPageColor({ r: 0.2, g: 0.4, b: 0.6, a: 1 })
  })
})

test('choosing a color profile asks how, and Cancel keeps the profile', async () => {
  const dialog = await chooseProfile('Display P3')
  await expect(dialog).toContainText('Change the color profile to Display P3?')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  expect((await documentState()).space).toBe('srgb')
  await expect(
    propertySection(editor.page, 'Document').getByRole('combobox', { name: 'Color profile' })
  ).toHaveText('sRGB')
})

test('Assign keeps the values, and one undo puts the profile back', async () => {
  const dialog = await chooseProfile('Display P3')
  await dialog.getByRole('button', { name: 'Assign' }).click()
  const assigned = await documentState()
  expect(assigned.space).toBe('display-p3')
  expect(assigned.page.b).toBeCloseTo(0.6, 5)

  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await documentState()).space).toBe('srgb')
})

test('Convert rewrites the values to keep the colors, and one undo puts them back', async () => {
  const dialog = await chooseProfile('Display P3')
  await dialog.getByRole('button', { name: 'Convert' }).click()
  const converted = await documentState()
  expect(converted.space).toBe('display-p3')
  // The same blue takes less of P3's wider blue primary.
  expect(converted.page.b).toBeLessThan(0.6)

  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await documentState()).space).toBe('srgb')
  expect((await documentState()).page.b).toBeCloseTo(0.6, 5)
  editor.canvas.assertNoErrors()
})
