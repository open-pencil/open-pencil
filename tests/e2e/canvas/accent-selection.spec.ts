import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test')

test('selection chrome, size pill and ruler badges follow the accent color', async () => {
  const { page, canvas } = editor
  await page.getByTestId('app-settings-trigger').click()
  await page
    .getByRole('radiogroup', { name: 'Accent color', exact: true })
    .getByRole('radio', { name: 'Green', exact: true })
    .click()
  await page.getByTestId('app-settings-done').click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()

  await canvas.drawRect(160, 140, 240, 160)
  await canvas.waitForRender()
  canvas.assertNoErrors()
  expect(await canvas.screenshotCanvasRegion(560, 420)).toMatchSnapshot('green-selection.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })
})
