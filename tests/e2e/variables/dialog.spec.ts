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

test('manual modes switch by the attribute the collection names', async () => {
  const inspector = editor.page.getByTestId('collection-inspector')
  await inspector.getByTestId('variables-add-mode').click()
  const added = inspector.getByTestId('variables-mode').last()
  await expect(added.getByTestId('variables-mode-css')).toHaveText(
    '[data-test-collection="mode-3"]'
  )

  const attribute = inspector.getByTestId('variables-mode-attribute')
  await attribute.fill('data scheme')
  await expect(attribute).toHaveAttribute('aria-invalid', 'true')
  await attribute.press('Enter')
  // A refused attribute keeps the focus, so it can be corrected.
  await expect(attribute).toBeFocused()
  await attribute.fill('data-scheme')
  await attribute.press('Enter')

  await expect(added.getByTestId('variables-mode-css')).toHaveText('[data-scheme="mode-3"]')
  await expect(attribute).not.toHaveAttribute('aria-invalid', 'true')
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

function inspectorName() {
  return editor.page
    .getByTestId('token-inspector')
    .getByRole('textbox', { name: 'Name', exact: true })
}

test('the View menu opens the variables dialog', async () => {
  const dialog = editor.page.getByTestId('variables-dialog')
  // The color picker from the previous test takes the first Escape.
  await editor.page.keyboard.press('Escape')
  await expect(editor.page.locator('[data-picker-content]')).toBeHidden()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()

  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'View' }).click()
  await editor.page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Variables…' }).click()

  await expect(dialog).toBeVisible()
  editor.canvas.assertNoErrors()
})

test('a value points at another variable and detaches to what it showed', async () => {
  await variableRows().filter({ hasText: 'SwatchVar' }).click()
  await expect(inspectorName()).toHaveValue('SwatchVar')

  await editor.page
    .getByTestId('token-inspector')
    .getByTestId('variables-use-variable')
    .first()
    .click()
  await editor.page
    .getByRole('dialog', { name: 'Use a variable' })
    .getByRole('option', { name: /brand-color/ })
    .click()
  await expect(variableRows().filter({ hasText: 'SwatchVar' })).toContainText('brand-color')

  await editor.page.getByTestId('variables-detach-variable').first().click()
  await expect(variableRows().filter({ hasText: 'SwatchVar' })).toContainText('#FF0000')
  editor.canvas.assertNoErrors()
})

test('a name is edited in place and a CSS name CSS cannot use is refused', async () => {
  await variableRows().filter({ hasText: 'SwatchVar' }).getByText('SwatchVar').dblclick()
  const cell = editor.page.getByTestId('variables-cell-input')
  await cell.fill('Accent')
  await cell.press('Enter')
  await expect(variableRows().filter({ hasText: 'Accent' })).toHaveCount(1)

  await expect(inspectorName()).toHaveValue('Accent')
  const cssName = editor.page.getByTestId('variables-css-name')
  await cssName.fill('not valid')
  await expect(cssName).toHaveAttribute('aria-invalid', 'true')
  await cssName.press('Enter')
  await expect(editor.page.getByTestId('token-output')).not.toContainText('not valid')
  // A refused name keeps the focus, so it can be corrected.
  await expect(cssName).toBeFocused()

  // A pasted `var(--…)` is read as the name inside it.
  await cssName.fill('var(--accent-color)')
  await cssName.press('Enter')
  await expect(editor.page.getByTestId('token-output')).toContainText('--accent-color:')
  editor.canvas.assertNoErrors()
})

test('several tokens are duplicated, grouped, and deleted together', async () => {
  const before = await variableRows().count()
  await variableRows().filter({ hasText: 'Accent' }).click()
  await variableRows()
    .filter({ hasText: 'brand-color' })
    .click({ modifiers: ['ControlOrMeta'] })
  await expect(editor.page.getByTestId('token-bulk-inspector')).toContainText(
    '2 variables selected'
  )

  await variableRows().filter({ hasText: 'Accent' }).click({ button: 'right' })
  await editor.page.getByTestId('variables-duplicate').click()
  await expect(variableRows()).toHaveCount(before + 2)

  await editor.page.getByTestId('variables-group-name').fill('Copies')
  await editor.page.getByTestId('variables-group-name').press('Enter')
  const group = editor.page.getByTestId('variables-group').filter({ hasText: 'Copies' })
  await expect(group).toContainText('2')

  await group.click()
  await expect(variableRows()).toHaveCount(2)
  await variableRows().first().click()
  await variableRows()
    .last()
    .click({ modifiers: ['Shift'] })
  await editor.page.keyboard.press('Delete')
  await expect(group).toHaveCount(0)
  editor.canvas.assertNoErrors()
})

test('undo and redo reach the document from inside the dialog', async () => {
  // Deleting the last tokens of the filtered group above let the filter go.
  await expect(variableRows().filter({ hasText: 'beta-spacing' })).toHaveCount(1)
  await variableRows().filter({ hasText: 'beta-spacing' }).click()
  await inspectorName().fill('gap-spacing')
  await inspectorName().press('Enter')
  // Enter commits and hands the keyboard back to the list, on the selected row.
  await expect(variableRows().filter({ hasText: 'gap-spacing' })).toBeFocused()

  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  await expect(variableRows().filter({ hasText: 'beta-spacing' })).toHaveCount(1)
  await editor.page.keyboard.press('ControlOrMeta+Shift+KeyZ')
  await expect(variableRows().filter({ hasText: 'gap-spacing' })).toHaveCount(1)

  const names = await variableRows().allTextContents()
  await variableRows().filter({ hasText: 'gap-spacing' }).click()
  await editor.page.keyboard.press('Delete')
  await expect(variableRows().filter({ hasText: 'gap-spacing' })).toHaveCount(0)
  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  // The deleted variable comes back in its place, not at the end.
  await expect(variableRows()).toHaveText(names)
  editor.canvas.assertNoErrors()
})

test('a field with pending text keeps its own undo, and menus hold undo back', async () => {
  await variableRows().filter({ hasText: 'gap-spacing' }).click()
  await inspectorName().click()
  await inspectorName().press('End')
  await editor.page.keyboard.type('-draft')
  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  await expect(inspectorName()).toHaveValue('gap-spacing')
  await expect(variableRows().filter({ hasText: 'gap-spacing' })).toHaveCount(1)
  await inspectorName().blur()

  await variableRows().filter({ hasText: 'gap-spacing' }).click({ button: 'right' })
  await expect(editor.page.getByTestId('variables-row-menu')).toBeVisible()
  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  await expect(variableRows().filter({ hasText: 'gap-spacing' })).toHaveCount(1)
  await editor.page.keyboard.press('Escape')
  editor.canvas.assertNoErrors()
})

test('search finds variables by CSS name and by value', async () => {
  const search = editor.page.getByTestId('variables-search-input')
  const cssName = await variableRows()
    .filter({ hasText: 'gap-spacing' })
    .getByText(/^--/)
    .first()
    .textContent()

  await search.fill(cssName ?? '')
  await expect(variableRows()).toHaveCount(1)
  await expect(variableRows()).toContainText('gap-spacing')

  await variableRows().filter({ hasText: 'gap-spacing' }).click()
  await expect(editor.page.getByTestId('token-inspector')).toBeVisible()

  await search.fill('#FF0000')
  await expect(variableRows().filter({ hasText: 'brand-color' })).toHaveCount(1)
  await expect(variableRows().filter({ hasNotText: '#FF0000' })).toHaveCount(0)
  // The search hid the selected token, so it is no longer selected or editable.
  await expect(editor.page.getByTestId('token-inspector')).toBeHidden()
  await expect(editor.page.getByTestId('collection-inspector')).toBeVisible()

  await search.fill('')
  editor.canvas.assertNoErrors()
})

test('the add menu opens under its button after the dialog changes width', async () => {
  const viewport = editor.page.viewportSize()
  if (!viewport) throw new Error('viewport size is not set')
  const add = editor.page.getByTestId('variables-add-variable')
  await editor.page.setViewportSize({ width: 800, height: viewport.height })
  await expect(add).toHaveText('')
  await editor.page.setViewportSize({ width: 1600, height: viewport.height })
  await expect(add).toHaveText('Create variable')

  await add.click()
  const menu = editor.page.getByRole('menu')
  await expect(menu).toBeVisible()
  const button = await add.boundingBox()
  const opened = await menu.boundingBox()
  expect(opened?.y).toBeGreaterThan(button?.y ?? Infinity)
  expect(opened?.x).toBeGreaterThan((button?.x ?? 0) - (opened?.width ?? 0))

  await editor.page.keyboard.press('Escape')
  await editor.page.setViewportSize(viewport)
  editor.canvas.assertNoErrors()
})
