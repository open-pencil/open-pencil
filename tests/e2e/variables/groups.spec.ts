import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test('the variables list folds its groups and creates a variable in one from its heading', async () => {
  const { page } = editor
  await page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  const dialog = page.getByTestId('variables-dialog')
  await dialog.getByTestId('variables-empty-load-tailwind').click()
  await page.getByTestId('variables-import-confirm').click()
  await expect(page.getByTestId('variables-import-dialog')).toBeHidden()

  // `color` heads its palettes once and starts open; the palettes start folded.
  const groups = dialog.getByTestId('variable-group')
  const colorToggle = dialog.getByRole('button', { name: 'color (288)' })
  const redToggle = dialog.getByRole('button', { name: 'red (11)' })
  const red500 = dialog.getByTestId('variable-row').filter({ hasText: '--color-red-500' })
  await expect(colorToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(redToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(red500).toHaveCount(0)
  await redToggle.click()
  await expect(red500).toBeVisible()

  // Folding `color` hides its palettes and their tokens.
  await colorToggle.click()
  await expect(redToggle).toBeHidden()
  await expect(red500).toHaveCount(0)
  await colorToggle.click()
  await redToggle.click()
  await expect(red500).toHaveCount(0)

  // The heading's Create button names the variable inside the group.
  // Made from a folded group, the variable opens it.
  const red = groups.filter({ has: page.getByRole('button', { name: 'red (11)' }) })
  await red.hover()
  await red.getByRole('button', { name: 'Create variable in color/red' }).click()
  await page.getByTestId('variables-add-color').click()
  const row = dialog.getByTestId('variable-row').filter({ hasText: '--color-red-new-color' })
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('data-state', 'checked')
  editor.canvas.assertNoErrors()
})
