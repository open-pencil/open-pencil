import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

const theme = (background: string) =>
  JSON.stringify({
    color: {
      $type: 'color',
      background: { $value: background },
      surface: { $value: '{color.background}' }
    },
    space: { md: { $type: 'dimension', $value: { value: 1, unit: 'rem' } } }
  })

test('design token files import as a collection with a mode per file', async () => {
  await editor.page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  const dialog = editor.page.getByTestId('variables-dialog')
  await expect(dialog).toBeVisible()

  const chooser = editor.page.waitForEvent('filechooser')
  await dialog.getByTestId('variables-import-tokens').click()
  await (
    await chooser
  ).setFiles([
    {
      name: 'Light.tokens.json',
      mimeType: 'application/json',
      buffer: Buffer.from(theme('#ffffff'))
    },
    {
      name: 'Dark.tokens.json',
      mimeType: 'application/json',
      buffer: Buffer.from(theme('#09090b'))
    }
  ])

  const importDialog = editor.page.getByTestId('variables-import-dialog')
  await expect(importDialog.getByTestId('variables-import-summary')).toHaveText(
    '3 to add · 0 to update · 0 skipped'
  )
  await importDialog.getByTestId('variables-import-confirm').click()
  await expect(importDialog).toBeHidden()

  await expect(dialog.getByTestId('variable-row')).toHaveCount(3)
  const stylesheet = dialog.getByTestId('token-output')
  await expect(stylesheet).toContainText('--spacing-md: 1rem')
  // Each file is a mode: the second one's value goes under its condition.
  await expect(stylesheet).toContainText(/="dark"\][^}]*--color-background: #09090b/i)

  // The whole import is one step on the document's history.
  await dialog.getByTestId('variable-row').first().click()
  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  await expect(dialog.getByTestId('variable-row')).toHaveCount(0)
  editor.canvas.assertNoErrors()
})
