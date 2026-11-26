import type { Page } from '@playwright/test'

import { expect, test as chatTest } from '#tests/helpers/chat/fixture'
import type { ChatHarness } from '#tests/helpers/chat/harness'
import {
  recordNotifications,
  setWindowFocus,
  shownNotifications
} from '#tests/helpers/notifications'

/** Chats on a page whose notifications are recorded instead of shown. */
const test = chatTest.extend({
  page: async ({ page }, use) => {
    await recordNotifications(page)
    await use(page)
  }
})

async function turnOnInSettings(page: Page, label: string) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByRole('tab', { name: 'Notifications' }).click()
  await page.getByTestId('settings-notifications').getByRole('switch', { name: label }).click()
  await page.getByTestId('app-settings-done').click()
}

async function reply(chat: ChatHarness, text: string, count: number) {
  await chat.submit(text)
  await expect(chat.page.getByTestId('chat-message-assistant')).toHaveCount(count)
}

test('a finished reply notifies only when turned on and away, and its click shows that chat', async ({
  configuredChat: chat,
  page
}) => {
  await setWindowFocus(page, false)
  await reply(chat, 'First request', 1)
  await expect(chat.assistantMessage()).toContainText('mock response')
  expect(await shownNotifications(page)).toEqual([])

  await turnOnInSettings(page, 'A reply finished')
  // Text before a reply's tool calls only announces them; the answer is its last text.
  await reply(chat, 'Answer in multiple parts', 2)
  await expect
    .poll(() => shownNotifications(page))
    .toEqual([
      {
        // The title names who replied and where.
        title: expect.stringMatching(/OpenRouter.*Untitled/),
        body: 'Second',
        tag: expect.stringMatching(/^agent:/)
      }
    ])

  // Markdown reads as its text, without tables, task boxes, code ticks, or link targets.
  await reply(chat, 'Show a markdown table', 3)
  await expect.poll(() => shownNotifications(page)).toHaveLength(2)
  const preview = (await shownNotifications(page)).at(-1)?.body ?? ''
  expect(preview).toMatch(
    /^The button now has these states: Variants created Checked in preview See the guide\.$/
  )
  expect(preview).not.toMatch(/[|*`[\]]/)

  // Coming back to the window with the chat's tab in view closes what reported on it.
  await setWindowFocus(page, true)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.closedNotifications))
    .toBe('2')

  // Another document and the Design tab are in view when the notification is clicked.
  const tabs = page.getByTestId('tabbar-tab')
  const chatDocument = tabs.first()
  await expect(chatDocument).toHaveAttribute('aria-selected', 'true')
  await page.getByTestId('tabbar-new').click()
  await page.getByTestId('home-new-design').click()
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')
  await chat.designTab.click()
  await page.evaluate(() => document.dispatchEvent(new Event('notification-click')))
  await expect(chatDocument).toHaveAttribute('aria-selected', 'true')
  await expect(chat.chatTab).toHaveAttribute('aria-selected', 'true')

  // With the panels hidden, the click shows them again.
  await chat.designTab.click()
  await page.keyboard.press('ControlOrMeta+Backslash')
  await expect(chat.chatTab).toBeHidden()
  await page.evaluate(() => document.dispatchEvent(new Event('notification-click')))
  await expect(chat.chatTab).toHaveAttribute('aria-selected', 'true')
})

test('a failed reply notifies when turned on, but not while its chat is in view', async ({
  configuredChat: chat,
  page
}) => {
  await turnOnInSettings(page, 'A reply failed')
  const failure = page.locator('[data-slot="toast"]').filter({ hasText: 'invalid or expired' })

  await setWindowFocus(page, true)
  await chat.submit('Use the expired key')
  await expect(failure).toBeVisible()
  expect(await shownNotifications(page)).toEqual([])

  await setWindowFocus(page, false)
  await chat.submit('Use the expired key again')
  await expect
    .poll(() => shownNotifications(page))
    .toEqual([
      {
        title: expect.stringMatching(/OpenRouter.*Untitled/),
        // A failure is announced as one, not quoted from the reply.
        body: expect.not.stringContaining('expired key'),
        tag: expect.stringMatching(/^agent:/)
      }
    ])
  expect((await shownNotifications(page)).at(0)?.body.trim()).toBeTruthy()
})
