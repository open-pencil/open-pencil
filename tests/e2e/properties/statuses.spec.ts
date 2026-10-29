import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetupWithClear('/?test')

/** Builds a section and selects it, returning its id. */
async function createSection() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const section = store.graph.createNode('SECTION', store.state.currentPageId, {
      name: 'Checkout',
      x: 120,
      y: 160,
      width: 400,
      height: 260,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.graph.createNode('FRAME', section.id, {
      name: 'Cart',
      x: 40,
      y: 60,
      width: 160,
      height: 120
    })
    store.select([section.id])
    store.requestRender()
    return section.id
  })
}

function statusOf(id: string) {
  return editor.page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode(nodeId)?.status ?? null
  }, id)
}

test('sets a status from the Status section and from the label on the canvas', async () => {
  const id = await createSection()
  await editor.canvas.waitForRender()
  const section = propertySection(editor.page, 'Status')
  await section.getByRole('combobox', { name: 'Add status' }).click()
  await editor.page.getByRole('option', { name: 'Ready for dev' }).click()
  expect(await statusOf(id)).toBe('ready-for-dev')

  await editor.canvas.waitForRender()
  const pill = await editor.page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    const label = store?.renderer?.statusLabels.find((entry) => entry.nodeId === nodeId)
    if (!label) throw new Error('Status label not drawn')
    return { x: label.rect.x + label.rect.width / 2, y: label.rect.y + label.rect.height / 2 }
  }, id)
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    store?.clearSelection()
  })
  await editor.canvas.click(pill.x, pill.y)
  const menu = editor.page.getByTestId('status-label-menu')
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: 'Completed' }).click()
  expect(await statusOf(id)).toBe('completed')
  await expect(menu).toBeHidden()
})

test('dialog edits stay a draft that says what it changes until Apply, one undo step', async () => {
  const id = await createSection()
  await editor.page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    store?.setStatus([nodeId], 'ready-for-dev')
  }, id)
  await propertySection(editor.page, 'Status')
    .getByRole('button', { name: 'Edit statuses…' })
    .click()
  const dialog = editor.page.getByTestId('statuses-dialog')
  const apply = dialog.getByRole('button', { name: 'Apply' })
  await expect(apply).toBeDisabled()

  await dialog
    .locator('[data-state-id="ready-for-dev"]')
    .getByRole('button', { name: 'Delete status' })
    .click()
  await expect(dialog.getByTestId('statuses-unresolved')).toBeVisible()
  await expect(apply).toBeDisabled()
  expect(await statusOf(id)).toBe('ready-for-dev')

  await dialog.getByTestId('status-removed-row').getByRole('combobox', { name: 'Move to' }).click()
  await editor.page.getByRole('option', { name: 'Completed' }).click()
  await expect(dialog.getByRole('listitem')).toHaveCount(1)
  expect(await statusOf(id)).toBe('ready-for-dev')

  await apply.click()
  expect(await statusOf(id)).toBe('completed')
  await expect(dialog.locator('[data-state-id="ready-for-dev"]')).toHaveCount(0)

  await editor.page.keyboard.press('ControlOrMeta+z')
  expect(await statusOf(id)).toBe('ready-for-dev')
  await expect(dialog.locator('[data-state-id="ready-for-dev"]')).toHaveCount(1)
  await editor.page.keyboard.press('ControlOrMeta+Shift+z')
  expect(await statusOf(id)).toBe('completed')
})

test('closing the dialog with edits not applied asks before discarding them', async () => {
  await createSection()
  await propertySection(editor.page, 'Status')
    .getByRole('button', { name: 'Edit statuses…' })
    .click()
  const dialog = editor.page.getByTestId('statuses-dialog')
  const name = dialog.getByRole('textbox', { name: 'Name' }).first()
  await name.fill('Renamed')
  await name.press('Enter')
  await dialog.getByRole('button', { name: 'Close' }).click()
  const confirm = editor.page.getByRole('alertdialog')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Discard' }).click()
  await expect(dialog).toBeHidden()
  const names = await editor.page.evaluate(() =>
    window.openPencil
      ?.getStore?.()
      .statusWorkflow()
      .states.map((state) => state.name)
  )
  expect(names).not.toContain('Renamed')
})
