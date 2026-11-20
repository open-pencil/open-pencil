import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'
import { seedLibraryCopies } from '#tests/helpers/variables/library'

const editor = useEditorSetup()

test('library copies are told apart from local variables in the page panel and the inspector', async () => {
  await seedLibraryCopies(editor.page)

  const rows = editor.page.locator('[data-variable-mode-row]')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Theme')
  await expect(rows).not.toContainText('Theme (')

  const variables = propertySection(editor.page, 'Variables')
  await expect(variables).toContainText('2 / 1')

  await variables.getByRole('button', { name: 'Open variables' }).click()
  const dialog = editor.page.getByTestId('variables-dialog')
  const tabs = dialog.getByTestId('variables-collection-tab')
  await expect(tabs.filter({ hasText: 'Theme (1)' })).toHaveCount(1)
  await expect(tabs.filter({ hasText: 'Theme (2)' })).toHaveCount(1)
  await tabs.filter({ hasText: 'Size' }).click()
  await dialog.getByTestId('variable-row').filter({ hasText: 'gap' }).click()
  await expect(dialog.getByTestId('variables-hidden-from-publishing')).toBeVisible()

  await tabs.filter({ hasText: 'Theme (1)' }).click()
  await dialog.getByTestId('variable-row').filter({ hasText: 'radius' }).click()
  await expect(
    dialog.getByTestId('token-inspector').getByRole('textbox', { name: 'Name', exact: true })
  ).toHaveValue('radius')
  await expect(dialog.getByTestId('variables-hidden-from-publishing')).toHaveCount(0)
  await editor.page.keyboard.press('Escape')
})
