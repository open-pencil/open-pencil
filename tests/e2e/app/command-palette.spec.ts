import { range } from 'es-toolkit'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { addPages, currentPageName, visitPage } from '#tests/helpers/pages'

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

function openPalette() {
  return editor.page.keyboard
    .press(commandPaletteShortcut())
    .then(() => editor.page.getByRole('dialog', { name: 'Command palette' }))
}

test('command palette lists recent pages and finds other pages by name', async () => {
  await addPages(editor.page, ['Alpha', 'Beta', 'Gamma'])
  await visitPage(editor.page, 'Alpha')
  await visitPage(editor.page, 'Beta')

  const palette = await openPalette()
  await expect(palette.getByRole('option', { name: 'Alpha Recent' })).toBeVisible()
  await expect(palette.getByRole('option', { name: 'Page 1 Recent' })).toBeVisible()
  await expect(palette.getByRole('option', { name: /^Beta/ })).toHaveCount(0)
  await expect(palette.getByRole('option', { name: /^Gamma/ })).toHaveCount(0)

  await palette.getByRole('searchbox', { name: 'Search commands' }).fill('gamma')
  await palette.getByRole('option', { name: 'Gamma' }).click()
  await expect(palette).not.toBeVisible()
  await expect.poll(() => currentPageName(editor.page)).toBe('Gamma')
})

test('command palette goes to any page in a page step', async () => {
  await addPages(editor.page, ['Delta', 'Epsilon'])
  const current = await currentPageName(editor.page)

  const palette = await openPalette()
  await palette.getByRole('option', { name: 'Go to page…' }).click()
  await expect(palette.getByRole('option', { name: `${current} Current page` })).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  await palette.getByRole('button', { name: 'Back' }).click()
  await expect(palette.getByRole('option', { name: 'Go to page…' })).toBeVisible()

  await palette.getByRole('option', { name: 'Go to page…' }).click()
  await palette.getByRole('option', { name: 'Epsilon' }).click()
  await expect(palette).not.toBeVisible()
  await expect.poll(() => currentPageName(editor.page)).toBe('Epsilon')
})

test('command palette page step lists every page, beyond the search result limit', async () => {
  const names = range(1, 15).map((n) => `Chapter ${n}`)
  await addPages(editor.page, names)

  const palette = await openPalette()
  await palette.getByRole('option', { name: 'Go to page…' }).click()
  await expect(palette.getByRole('option', { name: /^Chapter 14/ })).toBeVisible()
  await editor.page.keyboard.press('Escape')
})
