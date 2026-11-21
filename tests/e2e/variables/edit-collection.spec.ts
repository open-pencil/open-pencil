import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test("a collection's Edit button opens the variables dialog on it", async () => {
  const { page } = editor
  await page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  const dialog = page.getByTestId('variables-dialog')
  await dialog.getByTestId('variables-empty-load-tailwind').click()
  await page.getByTestId('variables-import-confirm').click()
  await expect(page.getByTestId('variables-import-dialog')).toBeHidden()
  await dialog.getByTestId('variables-preset-select').click()
  await page.getByRole('option', { name: 'Bootstrap' }).click()
  await page.getByTestId('variables-import-confirm').click()
  await expect(page.getByTestId('variables-import-dialog')).toBeHidden()
  const collection = dialog.getByRole('textbox', { name: 'Collection' })
  await expect(collection).toHaveValue('Tailwind')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([store.createShape('RECTANGLE', 120, 120, 200, 120)])
  })
  const fill = page.getByRole('region', { name: 'Fill' })
  await fill.getByRole('button', { name: 'Apply variable' }).click()
  const picker = page.getByRole('dialog', { name: 'Apply variable' })
  const bootstrap = picker.locator('[data-slot="group-toggle"]', { hasText: 'Bootstrap' })
  await bootstrap.hover()
  await bootstrap.locator('..').getByRole('button', { name: 'Edit collection' }).click()

  await expect(picker).toBeHidden()
  await expect(collection).toHaveValue('Bootstrap')
  editor.canvas.assertNoErrors()
})
