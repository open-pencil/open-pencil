import type { Page } from '@playwright/test'

export class ChatHarness {
  constructor(readonly page: Page) {}

  get input() {
    return this.page.getByRole('textbox', { name: 'Describe a change' })
  }

  get chatTab() {
    return this.page.getByRole('tab', { name: 'AI' })
  }

  get designTab() {
    return this.page.getByRole('tab', { name: 'Design' })
  }

  get apiKeyInput() {
    return this.page.getByTestId('provider-settings-api-key')
  }

  get sendButton() {
    return this.page.getByTestId('chat-send-button')
  }

  get profileTrigger() {
    return this.page.getByTestId('chat-profile-selector')
  }

  userMessage() {
    return this.page.getByTestId('chat-message-user').last()
  }

  assistantMessage() {
    return this.page.getByTestId('chat-message-assistant').last()
  }

  async open(): Promise<void> {
    await this.page.goto('/')
    await this.page.evaluate(async () => {
      const themeModulePath = '/src/app/shell/theme.ts'
      const themeModule = await import(themeModulePath)
      themeModule.useAppTheme().setTheme('dark')
    })
    await this.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  }

  async configureOpenRouter(apiKey: string): Promise<void> {
    await this.chatTab.click()
    await this.page.getByTestId('provider-setup-open-settings').click()
    await this.page.locator('[data-model-id]').first().click()
    await this.page.getByTestId('settings-model-provider').click()
    await this.page.getByRole('option', { name: 'OpenRouter' }).click()
    await this.page.getByLabel('Name').fill('Claude Sonnet')
    await this.apiKeyInput.fill(apiKey)
    await this.page.getByRole('button', { name: 'Save model' }).click()
    await this.page.getByTestId('app-settings-done').click()
    await this.input.waitFor()
  }

  async submit(text: string): Promise<void> {
    await this.input.fill(text)
    await this.input.press('Enter')
  }
}
