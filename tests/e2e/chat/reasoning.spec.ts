import { test, expect } from '#tests/helpers/chat/fixture'
import { finishReasoning, installReasoningTransport } from '#tests/helpers/chat/reasoning'

test('expand while thinking auto-collapses but preserves manual opening', async ({
  configuredChat: chat,
  page
}) => {
  await page.getByTestId('provider-settings-trigger').click()
  await page.getByRole('combobox', { name: 'Reasoning display' }).click()
  await page.getByRole('option', { name: 'Expand while thinking', exact: true }).click()
  await page.getByTestId('app-settings-done').click()
  await installReasoningTransport(page)
  await chat.submit('Inspect the layout')
  const trigger = page.locator('[data-slot="chat-reasoning-trigger"]').last()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await finishReasoning(page)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await chat.submit('Inspect it again')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await trigger.click()
  await trigger.click()
  // Time the auto-close instead of sleeping past it.
  await page.clock.install()
  await finishReasoning(page)
  await expect(chat.assistantMessage()).toContainText('Finished inspecting')
  await page.clock.runFor(1500)
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
})

test('collapsed reasoning respects reduced motion and does not scroll old content to the bottom', async ({
  configuredChat: chat,
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await chat.submit('Show reasoning')
  const trigger = page.locator('[data-slot="chat-reasoning-trigger"]').first()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await chat.submit(Array.from({ length: 60 }, (_, i) => `Follow-up line ${i}`).join('\n'))
  await expect(chat.assistantMessage()).toBeVisible()
  const viewport = page.getByTestId('chat-panel').locator('[data-reka-scroll-area-viewport]')
  await viewport.evaluate((element) => {
    element.scrollTop = 0
  })
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const content = page.locator('[data-slot="chat-reasoning-content"]').first()
  expect(await content.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
  await expect
    .poll(() =>
      viewport.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight
      )
    )
    .toBeGreaterThan(500)
  expect(await viewport.evaluate((element) => element.scrollTop)).toBeLessThan(30)
  await page.getByRole('button', { name: 'Jump to latest' }).click()
  await expect
    .poll(() =>
      viewport.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight
      )
    )
    .toBeLessThan(3)
})

test('reasoning preferences use AI settings and persist across reload', async ({
  configuredChat: chat,
  page
}) => {
  await page.getByTestId('provider-settings-trigger').click()
  const display = page.getByRole('combobox', { name: 'Reasoning display' })
  await expect(display).toContainText('Collapsed by default')
  await display.click()
  await page.getByRole('option', { name: 'Expanded by default', exact: true }).click()
  await page.getByTestId('app-settings-done').click()
  await chat.submit('Show your reasoning')
  const trigger = page.locator('[data-slot="chat-reasoning-trigger"]')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect
    .poll(() =>
      page
        .locator('[data-slot="chat-reasoning-content"]')
        .evaluate((element) => getComputedStyle(element).animationName)
    )
    .toBe('collapsible-up')
  await expect(page.locator('[data-slot="chat-reasoning-content"]')).toBeHidden()
  await page.reload()
  await chat.chatTab.click()
  await page.getByTestId('provider-settings-trigger').click()
  await expect(display).toContainText('Expanded by default')
})
