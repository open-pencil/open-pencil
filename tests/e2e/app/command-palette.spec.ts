import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

function commandPaletteShortcut() {
  return process.platform === 'darwin' ? 'Meta+KeyK' : 'Control+KeyK'
}

test('command palette opens, searches, and closes', async () => {
  await editor.page.keyboard.press(commandPaletteShortcut())

  const palette = editor.page.getByRole('dialog', { name: 'Command palette' })
  await expect(palette).toBeVisible()

  const search = palette.getByRole('searchbox', { name: 'Search commands' })
  await expect(search).toBeFocused()
  await search.fill('zoom')
  await expect(palette.getByRole('option', { name: /Zoom to fit/ })).toBeVisible()
  await expect(palette.getByRole('option', { name: 'New' })).not.toBeVisible()

  await editor.page.keyboard.press('Escape')
  await expect(palette).not.toBeVisible()
})

test('command palette exposes contextual export labels', async () => {
  await editor.page.keyboard.press(commandPaletteShortcut())

  const palette = editor.page.getByRole('dialog', { name: 'Command palette' })
  await palette.getByRole('searchbox', { name: 'Search commands' }).fill('export')
  await expect(palette.getByText('Export selection as PNG')).toBeVisible()
  await expect(palette.getByText('Export selection as SVG')).toBeVisible()

  await editor.page.keyboard.press('Escape')
})
