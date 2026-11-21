import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test('the variable picker groups Tailwind by path, and lists what was applied as Recent', async () => {
  const { page } = editor
  await page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  const dialog = page.getByTestId('variables-dialog')
  await dialog.getByTestId('variables-empty-load-tailwind').click()
  await page.getByTestId('variables-import-confirm').click()
  await expect(page.getByTestId('variables-import-dialog')).toBeHidden()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('RECTANGLE', 120, 120, 200, 120)
    store.updateNode(id, {
      fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    store.select([id])
  })
  const fill = page.getByRole('region', { name: 'Fill' })
  const picker = page.getByRole('dialog', { name: 'Apply variable' })
  await fill.getByRole('button', { name: 'Apply variable' }).click()

  // `color/white` sits under the Color heading; `color/red/500` in the closed folder red.
  await expect(picker.locator('[data-slot="section"]')).toHaveText(['color'])
  await expect(picker.getByRole('option', { name: 'color/white' })).toBeVisible()
  await expect(picker.getByRole('option', { name: 'color/red/500' })).toHaveCount(0)
  await picker.getByRole('button', { name: 'red', exact: true }).click()
  await picker.getByRole('option', { name: 'color/red/500' }).click()
  await expect(fill).toContainText('color/red/500')

  // Reopened, the variable comes first, under Recent, and its folder is open.
  await fill.getByRole('button', { name: 'Apply variable' }).click()
  const recent = picker.getByRole('button', { name: 'Recent', exact: true })
  await expect(recent).toHaveAttribute('aria-expanded', 'true')
  await expect(picker.getByRole('option').first()).toHaveText(/color\/red\/500/)
  await expect(picker.getByRole('button', { name: 'red', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true'
  )

  // The Color heading and the Tailwind collection fold what they hold.
  const color = picker.locator('[data-slot="section"]', { hasText: 'color' })
  await color.click()
  await expect(color).toHaveAttribute('aria-expanded', 'false')
  await expect(picker.getByRole('option', { name: 'color/white' })).toHaveCount(0)
  await picker.locator('[data-slot="group-toggle"]', { hasText: 'Tailwind' }).click()
  await expect(picker.locator('[data-slot="section"]')).toHaveCount(0)

  // A search opens the folders it matches.
  await picker.locator('input').first().fill('blue')
  await expect(picker.getByRole('option', { name: 'color/blue/500' })).toBeVisible()
  editor.canvas.assertNoErrors()
})
