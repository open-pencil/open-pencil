import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test("the Tailwind preset loads Tailwind's default colors and spacing as one undoable step", async () => {
  await editor.page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  const dialog = editor.page.getByTestId('variables-dialog')
  await expect(dialog.getByTestId('variables-preset-select')).toHaveText('Themes')

  await dialog.getByTestId('variables-empty-load-tailwind').click()
  const importDialog = editor.page.getByTestId('variables-import-dialog')
  // 288 colors and 35 spacing steps.
  await expect(importDialog.getByTestId('variables-import-summary')).toHaveText(
    '323 to add · 0 to update · 0 skipped'
  )
  await importDialog.getByTestId('variables-import-confirm').click()
  await expect(importDialog).toBeHidden()

  const stylesheet = dialog.getByTestId('token-output')
  // Tailwind's own sRGB fallback for red-500.
  await expect(stylesheet).toContainText('--color-red-500: #FB2C36')

  await dialog.getByTestId('variable-row').first().click()
  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  await expect(dialog.getByTestId('variable-row')).toHaveCount(0)
  editor.canvas.assertNoErrors()
})
