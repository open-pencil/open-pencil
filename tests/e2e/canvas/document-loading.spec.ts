import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test&no-chrome&no-rulers')

test('shows staged and determinate document loading progress in the existing canvas overlay', async () => {
  await editor.page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
    const load = store.preparationController.begin({
      kind: 'document-open',
      phase: 'resolving-fonts',
      subject: 'example.fig'
    })
    load.update({
      phase: 'resolving-fonts',
      detail: 'Geist SemiBold',
      completed: 7,
      total: 12,
      unit: 'fonts'
    })
  })

  const loader = editor.page.getByTestId('canvas-loading')
  await expect(loader).toBeVisible()
  await expect(loader).toHaveAttribute('role', 'status')
  await expect(loader).toContainText('Resolving fonts')
  await expect(loader).toContainText('Geist SemiBold')
  await expect(loader).toContainText('7 of 12')
  await expect(loader.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '58')
  for (const appearance of ['light', 'dark'] as const) {
    await editor.page.evaluate(async (appearance) => {
      const path = '/src/app/shell/theme.ts'
      const module = await import(path)
      module.useAppTheme().setTheme(appearance)
    }, appearance)
    const mark = loader.locator('img')
    await expect(mark).toHaveAttribute('src', '/brand/app-icon.svg')
    await expect(mark).toHaveAttribute('alt', '')
    await expect(mark).toHaveScreenshot(`loading-brand-${appearance}.png`, {
      maxDiffPixels: 0,
      threshold: 0.1
    })
  }

  await editor.page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) return
    store.preparationController.dispose()
  })
  await expect(loader).toBeHidden()
})
