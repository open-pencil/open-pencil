import { expect, test } from '#tests/helpers/chat/fixture'

test('assistant responds', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
})

test('reasoning and response copy actions render', async ({ configuredChat: chat }) => {
  await chat.submit('Show reasoning')

  // Reasoning that streamed in this session reports how long the model thought.
  const reasoning = chat.assistantMessage().getByRole('button', { name: /^Thought for \d+s$/ })
  await expect(reasoning).toHaveAttribute('data-state', 'closed')
  await reasoning.click()
  await expect(reasoning).toHaveAttribute('data-state', 'open')
  await expect(
    chat.assistantMessage().locator('[data-slot="chat-reasoning-content"]')
  ).toBeVisible()
  await expect(chat.assistantMessage().getByRole('button', { name: 'Copy response' })).toBeVisible()
})

test('multipart assistant messages expose one copy action', async ({ configuredChat: chat }) => {
  await chat.submit('Show multiple parts')
  await expect(chat.assistantMessage()).toContainText('Second')
  await expect(chat.assistantMessage().getByRole('button', { name: 'Copy response' })).toHaveCount(
    1
  )
})

test('tool calls render their result', async ({ configuredChat: chat }) => {
  await chat.submit('Create a frame')
  // The status icon's label leads the call's accessible name.
  await expect(
    chat.assistantMessage().getByRole('button', { name: /^Done Create Shape\b/ })
  ).toBeVisible()
  await expect(chat.assistantMessage().getByText('Created a frame', { exact: false })).toBeVisible()
})

test('opening a tool call at the bottom keeps it in place instead of following', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit(Array.from({ length: 60 }, (_, i) => `Context line ${i}`).join('\n'))
  await chat.submit('Create a frame')
  const trigger = chat.assistantMessage().getByRole('button', { name: /^Done Create Shape\b/ })
  await expect(trigger).toBeVisible()
  const top = async () => (await trigger.boundingBox())?.y ?? 0
  const before = await top()

  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  // Sample through the expansion: following would scroll the header up as the card grows.
  for (let frame = 0; frame < 10; frame++) {
    expect(Math.abs((await top()) - before)).toBeLessThan(2)
    await page.waitForTimeout(30)
  }
})

test('scrolling back to the bottom resumes following new output', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit('Paused stream')
  await expect(chat.assistantMessage()).toContainText('Line 39')
  const viewport = page
    .locator('[data-reka-scroll-area-viewport]')
    .filter({ has: chat.assistantMessage() })
  const atBottom = () =>
    viewport.evaluate((element) => {
      return element.scrollTop + element.clientHeight >= element.scrollHeight - 2
    })
  const box = await viewport.boundingBox()
  if (!box) throw new Error('Expected the transcript to be visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  await page.mouse.wheel(0, -400)
  await expect.poll(atBottom).toBe(false)
  await page.mouse.wheel(0, 100_000)
  await expect.poll(atBottom).toBe(true)
  // A further tick at the bottom scrolls nothing and must not stop following.
  await page.mouse.wheel(0, 200)
  await page.evaluate(() => window.dispatchEvent(new Event('mock-chat-continue')))

  await expect(chat.assistantMessage()).toContainText('Line 79')
  await expect.poll(atBottom).toBe(true)
})

test('scrolling up a reply that fits does not stop following', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit('Paused short stream')
  await expect(chat.assistantMessage()).toContainText('Line 1')
  const viewport = page
    .locator('[data-reka-scroll-area-viewport]')
    .filter({ has: chat.assistantMessage() })
  const box = await viewport.boundingBox()
  if (!box) throw new Error('Expected the transcript to be visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  // Nothing is above the reply yet, so the wheel cannot move the transcript.
  await page.mouse.wheel(0, -400)
  await page.evaluate(() => window.dispatchEvent(new Event('mock-chat-continue')))

  await expect(chat.assistantMessage()).toContainText('Line 41')
  await expect
    .poll(() =>
      viewport.evaluate(
        (element) => element.scrollTop + element.clientHeight >= element.scrollHeight - 2
      )
    )
    .toBe(true)
})

test('authentication errors explain the cause and link to Settings', async ({
  configuredChat: chat
}) => {
  await chat.submit('Trigger expired key error')

  const toast = chat.page.locator('[data-slot="toast"]').filter({
    hasText: 'Your provider API key is invalid or expired. Replace it in Settings.'
  })
  await expect(toast).toBeVisible()
  await expect(chat.page.locator('[data-slot="toast"]')).toHaveCount(1)
  await toast.getByRole('button', { name: 'Open settings' }).click()
  await expect(chat.page.getByTestId('app-settings-dialog')).toBeVisible()
})

test('transport errors show a safe localized toast', async ({ configuredChat: chat }) => {
  await chat.submit('Trigger missing agent error')
  await expect(
    chat.page.locator('[data-slot="toast"]').filter({
      hasText: 'The model request failed. Check the provider settings and try again.'
    })
  ).toBeVisible()
})

test('a request that failed before any reply can be retried', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
  await chat.submit('Flaky request')

  const toast = chat.page.locator('[data-slot="toast"]')
  await expect(toast.getByRole('button', { name: 'Retry' })).toBeVisible()
  // The failed request offers the retry; the earlier reply does not offer to regenerate itself.
  await expect(chat.userMessage().getByTestId('chat-retry')).toBeVisible()
  await expect(chat.page.getByTestId('chat-regenerate')).toHaveCount(0)

  await chat.userMessage().getByTestId('chat-retry').click()
  await expect(chat.assistantMessage()).toContainText('Flaky request')
  await expect(chat.page.getByTestId('chat-message-user')).toHaveCount(2)
  await expect(chat.page.getByTestId('chat-message-assistant')).toHaveCount(2)
  await expect(chat.page.getByTestId('chat-message-assistant').first()).toContainText('Hello there')
  await expect(chat.page.getByTestId('chat-retry')).toHaveCount(0)
  await expect(chat.assistantMessage().getByTestId('chat-regenerate')).toBeVisible()
})
