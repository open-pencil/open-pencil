import type { DiagnosticEvent } from '@/app/diagnostics/types'

import { test, expect } from '#tests/helpers/chat/fixture'

test('Settings exports correlated chat telemetry without conversation content', async ({
  configuredChat: chat,
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await chat.submit('Private conversation content must not enter diagnostics')
  await expect(chat.assistantMessage()).toBeVisible()
  await expect(chat.input).toBeEnabled()
  await chat.submit('A second request in the same conversation')
  await expect(page.getByTestId('chat-message-assistant')).toHaveCount(2)
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-diagnostics').click()
  await page.getByRole('button', { name: 'Copy diagnostics', exact: true }).click()
  await expect(page.getByText('Diagnostics copied to clipboard.', { exact: true })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  const events: DiagnosticEvent[] = JSON.parse(text)
  const completed = events.filter((event) => event.name === 'chat.completed')
  expect(completed).toHaveLength(2)
  expect(completed[0].sessionId).toEqual(expect.any(String))
  expect(completed[1].sessionId).toBe(completed[0].sessionId)
  expect(completed[0].runId).toEqual(expect.any(String))
  expect(completed[1].runId).toEqual(expect.any(String))
  expect(completed[1].runId).not.toBe(completed[0].runId)
  expect(text).not.toContain('Private conversation content')
  expect(text).not.toContain('A second request')
})
