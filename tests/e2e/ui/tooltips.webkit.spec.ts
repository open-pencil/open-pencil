import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertyItems, propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

test.skip(({ browserName }) => browserName !== 'webkit', 'WebKit tooltip smoke test')

test('tooltips stay hoverable and clickable in WebKit', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(180, 180, 80, 80)

  const strokeItems = propertyItems(editor.page, 'strokes')
  const strokeCount = await strokeItems.count()
  const strokeAdd = propertySection(editor.page, 'Stroke').getByRole('button', {
    name: 'Add stroke'
  })
  await strokeAdd.hover()
  await expect(
    editor.page.locator('[role=tooltip]').filter({ hasText: 'Add stroke' })
  ).toBeVisible()
  await strokeAdd.click()
  await expect(strokeItems).toHaveCount(strokeCount + 1)

  const effectAdd = propertySection(editor.page, 'Effects').getByRole('button', {
    name: 'Add effect'
  })
  await effectAdd.hover()
  await expect(
    editor.page.locator('[role=tooltip]').filter({ hasText: 'Add effect' })
  ).toBeVisible()
  await effectAdd.click()
  await expect(propertyItems(editor.page, 'effects')).toHaveCount(1)

  await editor.page.keyboard.press('Meta+J')
  await expect(editor.page.getByTestId('provider-setup')).toBeVisible()
  await editor.page.getByTestId('api-key-input').fill('test-key')
  await editor.page.getByTestId('api-key-save').click()
  await expect(editor.page.getByTestId('chat-input')).toBeVisible()

  const add = editor.page.getByTestId('chat-add-menu')
  await add.hover()
  await expect(
    editor.page.locator('[role=tooltip]').filter({ hasText: 'Add images, layers, or a command' })
  ).toBeVisible()
  await add.click()
  await expect(editor.page.getByRole('menuitem', { name: 'Attach images' })).toBeVisible()
})
