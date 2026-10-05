import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { variablesAddTestId } from '#tests/helpers/test-ids'

const editor = useEditorSetup()

async function createColorVariable(name: string) {
  return editor.page.evaluate((varName: string) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const existing = [...store.graph.variableCollections.values()]
    const col = existing.length > 0 ? existing[0] : store.graph.createCollection('Test Collection')
    const v = store.graph.createVariable(varName, 'COLOR', col.id, { r: 1, g: 0, b: 0, a: 1 })
    store.state.sceneVersion++
    return v.id
  }, name)
}

function variableRows() {
  return editor.page.getByTestId('variable-row')
}

function openVariables() {
  return editor.page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
}

test('empty variables dialog offers to create a collection', async () => {
  await openVariables().click()

  const dialog = editor.page.getByTestId('variables-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('No variable collections')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Create collection' })).toBeVisible()
  await editor.page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('variables dialog opens on the token list, collection, and stylesheet', async () => {
  await createColorVariable('primary-color')

  await openVariables().click()
  const dialog = editor.page.getByTestId('variables-dialog')
  await expect(dialog).toBeVisible()
  await expect(variableRows()).toHaveCount(1)
  await expect(dialog.getByTestId('collection-inspector').getByText('Default')).toBeVisible()
  await expect(dialog.getByTestId('token-output')).toContainText('--color-primary-color: #FF0000')
  editor.canvas.assertNoErrors()
})

test('search filters variable rows', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const col = [...store.graph.variableCollections.values()][0]
    store.graph.createVariable('beta-spacing', 'FLOAT', col.id, 8)
    store.state.sceneVersion++
  })
  await editor.canvas.waitForRender()

  const searchInput = editor.page.getByTestId('variables-search-input')
  await searchInput.fill('primary')

  await expect(variableRows()).toHaveCount(1, { timeout: 3000 })
  editor.canvas.assertNoErrors()
})

test('add variable menu creates non-color variable types', async () => {
  await editor.page.getByTestId('variables-search-input').fill('')
  await editor.canvas.waitForRender()

  await editor.page.getByTestId('variables-add-variable').click()
  const numberOption = editor.page.getByTestId(variablesAddTestId('FLOAT'))
  const numberHint = numberOption.getByText('Sizes, spacing, opacity')
  await expect(numberHint).toBeVisible()
  expect(await numberHint.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true
  )
  await editor.page.keyboard.press('Escape')
  await expect(numberOption).toBeHidden()
  await expect(editor.page.getByTestId('variables-dialog')).toBeVisible()

  await editor.page.getByTestId('variables-add-variable').click()
  await editor.page.getByTestId(variablesAddTestId('FLOAT')).click()
  await expect(
    editor.page.getByTestId('variable-row').filter({ hasText: 'New number' })
  ).toHaveCount(1)

  await editor.page.getByTestId('variables-add-variable').click()
  await editor.page.getByTestId(variablesAddTestId('STRING')).click()
  await expect(editor.page.getByTestId('variable-row').filter({ hasText: 'New text' })).toHaveCount(
    1
  )

  await editor.page.getByTestId('variables-add-variable').click()
  await editor.page.getByTestId(variablesAddTestId('BOOLEAN')).click()
  await expect(
    editor.page.getByTestId('variable-row').filter({ hasText: 'New boolean' })
  ).toHaveCount(1)
  editor.canvas.assertNoErrors()
})

test('selecting a variable edits it in the inspector', async () => {
  await editor.page.getByTestId('variables-search-input').fill('')
  await editor.canvas.waitForRender()

  await variableRows().filter({ hasText: 'primary-color' }).click()
  const inspector = editor.page.getByTestId('token-inspector')
  const name = inspector.getByRole('textbox', { name: 'Name', exact: true })
  await expect(name).toHaveValue('primary-color')
  await name.fill('brand-color')
  await name.press('Enter')

  await expect(variableRows().filter({ hasText: 'brand-color' })).toHaveCount(1)
  editor.canvas.assertNoErrors()
})

test('deleting a variable removes its row', async () => {
  await variableRows().filter({ hasText: 'New boolean' }).click()
  const inspector = editor.page.getByTestId('token-inspector')
  // The inspector swaps in for the newly selected token; act on it once it shows that token.
  await expect(inspector.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
    'New boolean'
  )
  await inspector.getByTestId('variables-delete-variable').click()

  await expect(variableRows().filter({ hasText: 'New boolean' })).toHaveCount(0)
  await expect(editor.page.getByTestId('collection-inspector')).toBeVisible()
  editor.canvas.assertNoErrors()
})

test('a new mode is switched manually until a condition is picked', async () => {
  const inspector = editor.page.getByTestId('collection-inspector')
  await inspector.getByTestId('variables-add-mode').click()

  const modes = inspector.getByTestId('variables-mode')
  await expect(modes).toHaveCount(2)
  const added = modes.nth(1)
  await expect(added.getByTestId('variables-mode-css')).toHaveText(
    '[data-test-collection="mode-2"]'
  )
  await expect(editor.page.getByTestId('token-list')).toContainText(
    'Mode 2[data-test-collection="mode-2"]'
  )

  await added.getByRole('combobox', { name: 'Mode 2: Applies when' }).click()
  await editor.page.getByRole('option', { name: 'Screen is narrower than' }).click()
  await expect(added.getByTestId('variables-mode-css')).toHaveText('@media (max-width: 640px)')
  await added.getByRole('spinbutton', { name: 'Mode 2: Width' }).fill('480')
  await added.getByRole('spinbutton', { name: 'Mode 2: Width' }).press('Enter')
  await expect(added.getByTestId('variables-mode-css')).toHaveText('@media (max-width: 480px)')
  await expect(editor.page.getByTestId('token-list')).toContainText(
    'Mode 2Screen is narrower than 480px'
  )
  editor.canvas.assertNoErrors()
})

test('color swatch opens color picker', async () => {
  await createColorVariable('SwatchVar')
  // close dialog if open from previous test
  await editor.page.keyboard.press('Escape')
  await editor.page.waitForTimeout(200)
  await openVariables().click()
  await expect(editor.page.getByTestId('variables-dialog')).toBeVisible({ timeout: 3000 })

  await variableRows().filter({ hasText: 'SwatchVar' }).click()
  await expect(
    editor.page.getByTestId('token-inspector').getByRole('textbox', { name: 'Name', exact: true })
  ).toHaveValue('SwatchVar')
  const swatch = editor.page
    .getByTestId('token-inspector')
    .getByRole('button', { name: 'Edit color' })
    .first()
  await expect(swatch).toBeVisible({ timeout: 3000 })
  await swatch.click()
  await expect(editor.page.locator('[data-picker-content]')).toBeVisible({ timeout: 5000 })
  editor.canvas.assertNoErrors()
})
