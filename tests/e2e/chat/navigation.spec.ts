import { expect, test } from '#tests/helpers/chat/fixture'

test('⌘J switches between Design and AI', async ({ chat }) => {
  await chat.designTab.waitFor()
  await chat.page.keyboard.press('Meta+j')
  await expect(chat.chatTab).toHaveAttribute('data-state', 'active')
  await chat.page.keyboard.press('Meta+j')
  await expect(chat.designTab).toHaveAttribute('data-state', 'active')
})

test('AI tab directs provider setup to unified settings', async ({ chat }) => {
  await chat.chatTab.click()
  await expect(chat.page.getByText('Connect an AI provider to start chatting.')).toBeVisible()
  await expect(chat.page.getByTestId('provider-setup-open-settings')).toBeVisible()
  await expect(chat.apiKeyInput).toBeHidden()
})

test('saving an API key in Settings opens the chat interface', async ({ chat }) => {
  await chat.chatTab.click()
  await chat.page.getByTestId('provider-setup-open-settings').click()
  await expect(chat.page.getByTestId('app-settings-dialog')).toBeVisible()
  await expect(chat.page.getByTestId('settings-remember-credentials')).toHaveAttribute(
    'data-state',
    'checked'
  )
  await expect(chat.page.getByTestId('settings-credential-backend')).toContainText(
    'encrypted browser storage'
  )
  await chat.page.locator('[data-model-id]').first().click()
  await chat.page.getByTestId('settings-model-provider').click()
  await chat.page.getByRole('option', { name: 'OpenRouter' }).click()
  await chat.page.getByLabel('Name').fill('Claude Sonnet')
  await chat.apiKeyInput.fill('sk-or-test-key-12345')
  await chat.page.getByRole('button', { name: 'Save model' }).click()
  await chat.page.getByTestId('app-settings-done').click()

  await expect(chat.input).toBeVisible()
  await expect(chat.page.getByText('Describe what you want to create or change.')).toBeVisible()
})
