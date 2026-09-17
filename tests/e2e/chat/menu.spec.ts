import { test, expect } from '#tests/helpers/chat/fixture'

test('mobile conversation menu stays attached to its trigger and inside the viewport', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit('Mobile menu conversation')
  await expect(chat.assistantMessage()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('mobile-ribbon-ai').click()
  const trigger = page.getByRole('button', { name: 'Conversation actions' })
  await expect(trigger).toBeVisible()
  const triggerBox = await trigger.boundingBox()
  await trigger.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Delete'])
  await expect
    .poll(async () => {
      const box = await menu.boundingBox()
      if (!box || !triggerBox) return false
      return (
        box.x >= 0 &&
        box.x + box.width <= 390 &&
        box.y >= 0 &&
        box.y + box.height <= 844 &&
        Math.abs(box.x + box.width - triggerBox.x - triggerBox.width) < 2
      )
    })
    .toBe(true)
})
