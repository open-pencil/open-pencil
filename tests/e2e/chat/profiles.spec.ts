import { expect, test } from '#tests/helpers/chat/fixture'

test('Design profile selector exposes provider and capabilities', async ({
  configuredChat: chat
}) => {
  await chat.profileTrigger.click()

  await expect(chat.page.getByText('Design agent', { exact: true })).toBeVisible()
  await expect(chat.page.getByRole('option', { name: /Claude Sonnet/ })).toContainText('OpenRouter')
  await expect(chat.page.getByLabel('Supports image input')).toBeVisible()
  await expect(chat.page.getByRole('button', { name: 'Manage models and roles…' })).toBeVisible()
})

test('OpenRouter accepts a custom model ID from Settings', async ({ configuredChat: chat }) => {
  const customModel = 'meta-llama/llama-3.3-70b-instruct'
  await chat.page.getByTestId('provider-settings-trigger').click()
  await chat.page.locator('[data-model-id]').first().click()
  await chat.page.getByLabel('Model ID').click()
  await chat.page.getByRole('option', { name: 'Custom model…' }).click()
  const input = chat.page.getByTestId('provider-settings-custom-model')
  await input.fill(customModel)
  await chat.page.getByRole('button', { name: 'Save model' }).click()
  await chat.page.getByTestId('app-settings-done').click()

  await expect(chat.profileTrigger).toContainText('Claude Sonnet')
})

test('Get API key opens the provider URL', async ({ configuredChat: chat }) => {
  await chat.page.getByTestId('provider-settings-trigger').click()
  await chat.page.locator('[data-model-id]').first().click()
  await chat.page.getByTestId('provider-settings-clear-key').click()
  await chat.page.getByRole('button', { name: 'Back' }).click()
  await chat.page.getByTestId('app-settings-done').click()
  await chat.page.getByTestId('provider-setup-open-settings').click()
  await chat.page.locator('[data-model-id]').first().click()
  await chat.page.getByTestId('settings-model-provider').click()
  await chat.page.getByRole('option', { name: 'OpenRouter' }).click()

  const openedURLs: string[] = []
  await chat.page.exposeFunction('mockWindowOpen', (url: string) => openedURLs.push(url))
  await chat.page.evaluate(() => {
    window.open = (url: string | URL) => {
      window.mockWindowOpen?.(String(url))
      return null
    }
  })
  await chat.page.getByRole('button', { name: 'Get API key →' }).click()

  await expect(() => expect(openedURLs[0]).toMatch(/^https:\/\//)).toPass()
})
