import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

test('a frame’s theme row shows the inherited mode, sets another for what is in it, and clears it', async () => {
  const ids = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const { graph } = store
    const theme = graph.createCollection('Theme')
    graph.renameMode(theme.id, theme.defaultModeId, 'Light')
    graph.createMode(theme.id, 'Dark')
    // Nothing binds a Theme variable yet: the row is there to pick the theme first.
    const frame = store.createShape('FRAME', 100, 100, 200, 160)
    const card = store.createShape('RECTANGLE', 20, 20, 80, 80, frame)
    store.select([frame])
    return { frame, card, theme: theme.id }
  })
  const modeOf = (id: string) =>
    editor.page.evaluate(
      ({ id, collection }) => {
        const graph = window.openPencil?.getStore?.().graph
        const modeId = graph?.getNodeVariableModeId(id, collection)
        return graph?.variableCollections.get(collection)?.modes.find((m) => m.modeId === modeId)
          ?.name
      },
      { id, collection: ids.theme }
    )

  const row = propertySection(editor.page, 'Appearance').locator('[data-variable-mode-row]')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Theme')
  const select = row.getByRole('combobox', { name: 'Theme' })
  await expect(select).toHaveText('Auto (Light)')
  const remove = row.getByRole('button', { name: 'Remove Theme mode' })
  await expect(remove).toBeHidden()

  await select.click()
  await editor.page.getByRole('option', { name: 'Dark', exact: true }).click()
  await expect(select).toHaveText('Dark')
  expect(await modeOf(ids.card)).toBe('Dark')

  await remove.click()
  await expect(select).toHaveText('Auto (Light)')
  expect(await modeOf(ids.frame)).toBe('Light')
  editor.canvas.assertNoErrors()
})
