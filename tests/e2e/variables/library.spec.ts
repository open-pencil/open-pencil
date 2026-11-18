import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

test('library copies are told apart from local variables in the page panel and the inspector', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const { graph } = store
    const theme = graph.createCollection('Theme')
    graph.renameMode(theme.id, theme.defaultModeId, 'Light')
    graph.createMode(theme.id, 'Dark')
    const radius = graph.createVariable('radius', 'FLOAT', theme.id, 4)
    Object.assign(theme, { key: 'theme-a', version: '1:1' })
    Object.assign(radius, { key: 'radius-a', version: '1:1', hiddenFromPublishing: true })
    graph.addCollection({
      ...structuredClone(theme),
      id: `${theme.id}-copy`,
      key: 'theme-b',
      variableIds: []
    })
    const size = graph.createCollection('Size')
    graph.createVariable('gap', 'FLOAT', size.id, 8)
    graph.createVariable('icon', 'FLOAT', size.id, 16)
    store.state.sceneVersion++
  })

  const rows = editor.page.locator('[data-variable-mode-row]')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Theme (1)')

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
