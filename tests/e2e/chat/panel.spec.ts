import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const USE_REAL_LLM = process.env.TEST_REAL_LLM === '1'
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? ''

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  await page.evaluate(async () => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme('dark')
  })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  if (!USE_REAL_LLM) {
    await injectMockTransport(page)
  }
})

test.afterAll(async () => {
  await page.close()
})

async function injectMockTransport(page: Page) {
  await page.evaluate(() => {
    const setChatTransport = window.openPencil?.setChatTransport
    if (!setChatTransport) throw new Error('Transport override not available')

    let msgCounter = 0

    setChatTransport(() => ({
      async sendMessages({
        messages
      }: {
        messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>
      }) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        const text = lastUser?.parts?.find((p) => p.type === 'text')?.text ?? ''
        const msgId = `mock-msg-${++msgCounter}`
        const lowerText = text.toLowerCase()
        const wantsTool = lowerText.includes('frame') || lowerText.includes('rectangle')
        const wantsCode = lowerText.includes('code block')

        if (lowerText.includes('missing agent')) {
          throw new Error(
            '"claude-agent-acp" is not installed. Install it with: npm i -g @agentclientprotocol/claude-agent-acp'
          )
        }

        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', messageId: msgId })

            if (wantsTool) {
              const toolCallId = `call-${msgId}`
              controller.enqueue({
                type: 'tool-input-start',
                toolCallId,
                toolName: 'create_shape'
              })
              controller.enqueue({
                type: 'tool-input-delta',
                toolCallId,
                inputTextDelta:
                  '{"type":"FRAME","x":100,"y":100,"width":200,"height":150,"name":"Card"}'
              })
              controller.enqueue({
                type: 'tool-input-available',
                toolCallId,
                toolName: 'create_shape',
                input: { type: 'FRAME', x: 100, y: 100, width: 200, height: 150, name: 'Card' }
              })
              controller.enqueue({
                type: 'tool-output-available',
                toolCallId,
                toolName: 'create_shape',
                output: {
                  id: '0:99',
                  type: 'FRAME',
                  x: 100,
                  y: 100,
                  width: 200,
                  height: 150,
                  name: 'Card'
                }
              })
            }

            let words: string[]
            if (wantsTool) words = ['Created', 'a', 'frame', 'called', '"Card".']
            else if (wantsCode) words = ['```typescript\nconst greeting = "Hello"\n```']
            else words = `I'll help you with: "${text}". Here's a mock response.`.split(' ')

            controller.enqueue({ type: 'text-start', id: 'text-1' })
            for (const word of words) {
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: word + ' ' })
            }
            controller.enqueue({ type: 'text-end', id: 'text-1' })
            controller.enqueue({ type: 'finish', finishReason: 'stop' })
            controller.close()
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))
  })
}

function chatTab() {
  return page.getByRole('tab', { name: 'AI' })
}

function designTab() {
  return page.getByRole('tab', { name: 'Design' })
}

function chatInput() {
  return page.getByRole('textbox', { name: 'Describe a change' })
}

function apiKeyInput() {
  return page.getByTestId('provider-settings-api-key')
}

test('⌘J switches to AI tab', async () => {
  await designTab().waitFor()
  await page.keyboard.press('Meta+j')
  await expect(chatTab()).toHaveAttribute('data-state', 'active')
})

test('⌘J switches back to Design tab', async () => {
  await page.keyboard.press('Meta+j')
  await expect(designTab()).toHaveAttribute('data-state', 'active')
})

test('clicking AI tab directs provider setup to unified settings', async () => {
  await chatTab().click()
  await expect(page.getByText('Connect an AI provider to start chatting.')).toBeVisible()
  await expect(page.getByTestId('provider-setup-open-settings')).toBeVisible()
  await expect(apiKeyInput()).toBeHidden()
})

test('saving API key in unified settings shows chat interface', async () => {
  const key = USE_REAL_LLM ? OPENROUTER_KEY : 'sk-or-test-key-12345'
  await page.getByTestId('provider-setup-open-settings').click()
  await expect(page.getByTestId('app-settings-dialog')).toBeVisible()
  await expect(page.getByTestId('settings-remember-credentials')).toHaveAttribute(
    'data-state',
    'checked'
  )
  await expect(page.getByTestId('settings-credential-backend')).toContainText(
    'encrypted browser storage'
  )
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter' }).click()
  await page.getByLabel('Name').fill('Claude Sonnet')
  await apiKeyInput().fill(key)
  await page.getByRole('button', { name: 'Save model' }).click()
  await page.getByTestId('app-settings-done').click()

  await expect(chatInput()).toBeVisible()
  await expect(page.getByText('Describe what you want to create or change.')).toBeVisible()
})

test('empty input has disabled send button', async () => {
  const sendButton = page.getByTestId('chat-send-button')
  await expect(sendButton).toBeDisabled()
})

test('typing enables send button', async () => {
  await chatInput().fill('Make a red rectangle')
  const sendButton = page.getByTestId('chat-send-button')
  await expect(sendButton).toBeEnabled()
})

test('multiple images appear inside the composer and can be removed', async () => {
  await chatInput().fill('')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Attach images' }).click()
  await (
    await chooser
  ).setFiles([
    'tests/fixtures/vectorize/pilot_avatar.png',
    'tests/fixtures/vectorize/python_logo.png'
  ])

  await expect(page.getByText('pilot_avatar.png', { exact: true })).toBeVisible()
  await expect(page.getByText('python_logo.png', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove image pilot_avatar.png' })).toBeVisible()

  await page.getByRole('button', { name: 'Remove image pilot_avatar.png' }).click()
  await expect(page.getByText('pilot_avatar.png', { exact: true })).toBeHidden()
  await expect(page.getByText('python_logo.png', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove image python_logo.png' }).click()
})

test('sending images shows the complete user message immediately', async () => {
  await chatInput().fill('Use these images for the new layout')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Attach images' }).click()
  await (
    await chooser
  ).setFiles([
    'tests/fixtures/vectorize/pilot_avatar.png',
    'tests/fixtures/vectorize/python_logo.png'
  ])

  await page.getByTestId('chat-send-button').click()

  const userMessage = page.getByTestId('chat-message-user').last()
  await expect(userMessage).toContainText('Use these images for the new layout', { timeout: 500 })
  await expect(
    userMessage.getByRole('button', { name: 'View image pilot_avatar.png' })
  ).toBeVisible({
    timeout: 500
  })
  await expect(userMessage.getByRole('button', { name: 'View image python_logo.png' })).toBeVisible(
    {
      timeout: 500
    }
  )
})

test('Shift+Enter inserts a line break without submitting', async () => {
  await chatInput().fill('First line')
  await chatInput().press('Shift+Enter')
  await chatInput().type('Second line')

  await expect(chatInput()).toHaveValue('First line\nSecond line')
  await expect(page.getByText('First line', { exact: true })).toBeHidden()
})

test('Enter submits message and clears input', async () => {
  await chatInput().fill('Hello there')
  await chatInput().press('Enter')

  await expect(page.getByText('Hello there', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(chatInput()).toHaveValue('')
})

test('assistant responds', async () => {
  if (USE_REAL_LLM) {
    await expect(page.locator('.chat-markdown, [class*="rounded-tl-md"]').first()).toBeVisible({
      timeout: 30000
    })
  } else {
    await expect(page.getByText('mock response', { exact: false })).toBeVisible({ timeout: 5000 })
  }
})

test('completed Markdown responses release streaming parser history', async () => {
  await chatInput().fill('Show a code block')
  await chatInput().press('Enter')

  const markdown = page.locator('.chat-markdown').last()
  await expect(markdown).toBeVisible()
  await expect(markdown).toHaveAttribute('data-chat-markdown-mode', 'static')
  await expect(markdown.locator('.shiki').first()).toBeVisible()
})

test('assistant code blocks follow the active theme with readable contrast', async () => {
  await chatInput().fill('Show a code block')
  await chatInput().press('Enter')

  const code = page.getByTestId('chat-message-assistant').last().locator('.shiki').first()
  await expect(code).toBeVisible()
  await expect(page.locator('.chat-markdown').last()).toHaveClass(/dark/)
  await expect(code).toHaveCSS('background-color', 'rgb(30, 30, 30)')
  await expect(code.locator('span').filter({ hasText: 'const' }).first()).not.toHaveCSS(
    'color',
    'rgb(240, 240, 240)'
  )
  await page.evaluate(async () => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme('light')
  })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
  await expect(page.locator('.chat-markdown').last()).toHaveClass(/light/)
  await expect(code).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

test('model selector is visible and clickable', async () => {
  const trigger = page.getByTestId('chat-model-selector')
  await expect(trigger).toBeVisible()
  await trigger.click()

  await expect(page.getByRole('option', { name: /Claude Sonnet 4\.6/ })).toBeVisible()
  await expect(page.getByText('Best for design')).toBeVisible()
  await expect(page.getByText('Free').first()).toBeVisible()

  await page.getByRole('option', { name: /Claude Sonnet 4\.6/ }).click()
  await expect(page.getByRole('option', { name: /Claude Sonnet 4\.6/ })).toBeHidden()
})

test('tool calls render in assistant message', async () => {
  await chatInput().fill('Create a frame')
  await chatInput().press('Enter')

  if (USE_REAL_LLM) {
    await expect(page.locator('.chat-markdown, [class*="rounded-tl-md"]').first()).toBeVisible({
      timeout: 30000
    })
  } else {
    await expect(page.getByText('Create Shape')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Done')).toBeVisible()
    await expect(page.getByText('Created a frame', { exact: false })).toBeVisible()
  }
})

test('switching tabs preserves chat', async () => {
  const selectedModel = page.getByRole('option', { name: /Claude Sonnet 4\.6/ })
  if (await selectedModel.isVisible().catch(() => false)) {
    await selectedModel.click()
  }
  await designTab().click({ timeout: 10000 })
  await expect(designTab()).toHaveAttribute('data-state', 'active')

  await chatTab().click()
  await expect(page.getByText('Hello there', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('OpenRouter accepts a custom model ID from provider settings', async () => {
  const customModel = 'meta-llama/llama-3.3-70b-instruct'

  await page.keyboard.press('Escape')
  await page.getByTestId('provider-settings-trigger').click()
  await page.locator('[data-model-id]').first().click()
  await page.getByLabel('Model ID').click()
  await page.getByRole('option', { name: 'Custom model…' }).click()
  const customModelInput = page.getByTestId('provider-settings-custom-model')
  await expect(customModelInput).toBeVisible()
  await customModelInput.fill(customModel)
  await page.getByRole('button', { name: 'Save model' }).click()
  await page.getByTestId('app-settings-done').click()

  await expect(page.getByTestId('chat-custom-model-label')).toContainText(customModel)
  await expect(page.getByTestId('chat-model-selector')).toBeHidden()

  await page.getByTestId('provider-settings-trigger').click()
  await page.locator('[data-model-id]').first().click()
  const savedCustomModelInput = page.getByTestId('provider-settings-custom-model')
  await savedCustomModelInput.fill('')
  await page.getByRole('combobox', { name: 'Model ID' }).click()
  await page.getByRole('option', { name: /Claude Sonnet 4\.6/ }).click()
  await page.getByRole('button', { name: 'Save model' }).click()
  await page.getByTestId('app-settings-done').click()

  await expect(page.getByTestId('chat-model-selector')).toBeVisible()
})

test('transport errors show a safe localized toast', async () => {
  await chatInput().fill('Trigger missing agent error')
  await chatInput().press('Enter')

  await expect(
    page.getByTestId('toast-item').filter({
      hasText: 'The model request failed. Check the provider settings and try again.'
    })
  ).toBeVisible({ timeout: 5000 })
})

test('"Get API key" link opens external URL via window.open', async () => {
  await page.getByTestId('provider-settings-trigger').click()
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('provider-settings-clear-key').click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByTestId('app-settings-done').click()
  await expect(page.getByTestId('provider-setup-open-settings')).toBeVisible()
  await page.getByTestId('provider-setup-open-settings').click()
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter' }).click()

  const link = page.getByRole('button', { name: 'Get API key →' })
  await expect(link).toBeVisible()

  // Intercept window.open to verify it's called with the right URL
  const openedUrls: string[] = []
  await page.exposeFunction('mockWindowOpen', (url: string) => openedUrls.push(url))
  await page.evaluate(() => {
    window.openPencil ??= {}
    window.openPencil.test = { ...window.openPencil.test, savedOpen: window.open }
    window.open = (url: string | URL) => {
      window.mockWindowOpen?.(String(url))
      return null
    }
  })

  await link.click()

  await expect(() => {
    expect(openedUrls.length).toBeGreaterThan(0)
    expect(openedUrls[0]).toMatch(/^https:\/\//)
  }).toPass({ timeout: 3000 })

  // Restore
  await page.evaluate(() => {
    const savedOpen = window.openPencil?.test?.savedOpen
    if (savedOpen) window.open = savedOpen
  })
})
