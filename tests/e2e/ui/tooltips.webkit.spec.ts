import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test.skip(({ browserName }) => browserName !== 'webkit', 'WebKit tooltip smoke test')

test('tooltips stay hoverable and clickable in WebKit', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(180, 180, 80, 80)

  const strokeItems = editor.page.getByTestId('stroke-item')
  const strokeCount = await strokeItems.count()
  const strokeAdd = editor.page.getByTestId('stroke-section-add')
  await strokeAdd.hover()
  await expect(
    editor.page.locator('[role=tooltip]').filter({ hasText: 'Add stroke' })
  ).toBeVisible()
  await strokeAdd.click()
  await expect(strokeItems).toHaveCount(strokeCount + 1)

  const effectAdd = editor.page.getByTestId('effects-section-add')
  await effectAdd.hover()
  await expect(
    editor.page.locator('[role=tooltip]').filter({ hasText: 'Add effect' })
  ).toBeVisible()
  await effectAdd.click()
  await expect(editor.page.getByTestId('effect-item')).toHaveCount(1)

  await editor.page.keyboard.press('Meta+J')
  await expect(editor.page.getByTestId('provider-setup')).toBeVisible()
  await editor.page.getByTestId('provider-setup-open-settings').click()
  await editor.page.getByTestId('provider-settings-api-key').fill('test-key')
  await editor.page.getByTestId('app-settings-done').click()
  await expect(editor.page.getByTestId('chat-input')).toBeVisible()

  const settings = editor.page.getByTestId('provider-settings-trigger')
  await settings.hover()
  await expect(
    editor.page.locator('[role=tooltip]').filter({ hasText: 'Provider settings' })
  ).toBeVisible()
  await settings.click()
  await expect(editor.page.getByTestId('provider-settings-provider')).toBeVisible()
})
