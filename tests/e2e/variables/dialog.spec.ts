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

test('variables dialog opens', async () => {
  await createColorVariable('primary-color')

  await editor.page.getByTestId('variables-section-open').click()
  await expect(editor.page.getByTestId('variables-dialog')).toBeVisible()
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
  await editor.page.getByTestId(variablesAddTestId('FLOAT')).click()
  await expect(
    editor.page.getByTestId('variable-row').filter({ hasText: 'New number' })
  ).toHaveCount(1)

  await editor.page.getByTestId('variables-add-variable').click()
  await editor.page.getByTestId(variablesAddTestId('STRING')).click()
  await expect(
    editor.page.getByTestId('variable-row').filter({ hasText: 'New text' })
  ).toHaveCount(1)

  await editor.page.getByTestId('variables-add-variable').click()
  await editor.page.getByTestId(variablesAddTestId('BOOLEAN')).click()
  await expect(
    editor.page.getByTestId('variable-row').filter({ hasText: 'New boolean' })
  ).toHaveCount(1)
  editor.canvas.assertNoErrors()
})

test('click name cell activates editable input', async () => {
  await editor.page.getByTestId('variables-search-input').fill('')
  await editor.canvas.waitForRender()

  const firstRow = variableRows().first()
  const nameCell = firstRow.locator('td').first()
  await nameCell.click()
  await editor.canvas.waitForRender()

  const editableInput = nameCell.locator('input, [contenteditable]').first()
  await expect(editableInput).toBeFocused()
  editor.canvas.assertNoErrors()
})

test('color swatch opens color picker', async () => {
  await createColorVariable('SwatchVar')
  // close dialog if open from previous test
  await editor.page.keyboard.press('Escape')
  await editor.page.waitForTimeout(200)
  await editor.page.getByTestId('variables-section-open').click()
  await expect(editor.page.getByTestId('variables-dialog')).toBeVisible({ timeout: 3000 })

  const swatch = editor.page
    .getByTestId('variable-row')
    .first()
    .getByTestId('color-picker-swatch')
  await expect(swatch).toBeVisible({ timeout: 3000 })
  await swatch.click()
  await expect(editor.page.getByTestId('color-picker-popover')).toBeVisible({ timeout: 5000 })
  editor.canvas.assertNoErrors()
})
