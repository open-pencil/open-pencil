import { expect, test } from '#tests/helpers/chat/fixture'

test('completed responses release streaming parser history', async ({ configuredChat: chat }) => {
  await chat.submit('Show a code block')

  const markdown = chat.page.locator('.chat-markdown').last()
  await expect(markdown).toHaveAttribute('data-chat-markdown-mode', 'static')
  await expect(markdown.locator('.shiki').first()).toBeVisible()
})

test('code blocks follow light and dark themes', async ({ configuredChat: chat }) => {
  await chat.submit('Show a code block')
  const code = chat.assistantMessage().locator('.shiki').first()
  await expect(code).toHaveCSS('background-color', 'rgb(30, 30, 30)')
  await expect(code.locator('span').filter({ hasText: 'const' }).first()).not.toHaveCSS(
    'color',
    'rgb(240, 240, 240)'
  )

  await chat.page.evaluate(async () => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme('light')
  })
  await chat.page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
  await expect(chat.page.locator('.chat-markdown').last()).toHaveClass(/light/)
  await expect(code).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

test('Markdown blocks unsafe links and cross-origin images', async ({ configuredChat: chat }) => {
  const approvedImageURL = new URL('/assets/approved.png', chat.page.url()).href
  await chat.page.route(approvedImageURL, async (route) => {
    await route.fulfill({
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69cbGAAAAABJRU5ErkJggg==',
        'base64'
      ),
      contentType: 'image/png'
    })
  })
  await chat.submit('Show unsafe Markdown')

  const assistant = chat.assistantMessage()
  await expect(assistant.locator('a[href^="javascript:"]')).toHaveCount(0)
  await expect(assistant.locator('img[src^="data:"]')).toHaveCount(0)
  await expect(assistant.getByRole('img', { name: 'approved' })).toHaveAttribute(
    'src',
    approvedImageURL
  )
  await expect(assistant.getByRole('img', { name: 'unapproved' })).toHaveCount(0)
  await expect(assistant.getByRole('img', { name: 'insecure' })).toHaveCount(0)
  await expect(assistant.getByRole('link', { name: 'safe' })).toHaveAttribute(
    'href',
    'https://openpencil.dev/'
  )
})
