import type { Page } from '@playwright/test'

import type { DiagnosticEvent } from '@/app/diagnostics/types'

import { CanvasHelper } from '#tests/helpers/canvas'
import { expect, test } from '#tests/helpers/chat/fixture'

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

async function openDiagnostics(page: Page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByTestId('settings-section-diagnostics').click()
}

async function reloadAndOpenDiagnostics(page: Page) {
  await page.reload()
  await new CanvasHelper(page).waitForInit()
  await openDiagnostics(page)
}

test('diagnostics retention offers presets and accepts a bounded custom value', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await openDiagnostics(page)
  const row = page
    .locator('[data-slot="settings-row"]')
    .filter({ hasText: 'Diagnostics retention' })
  await expect(row).toContainText('Keep up to this many recent events locally.')
  const retention = row.getByRole('combobox', { name: 'Diagnostics retention' })
  await expect(retention).toHaveText('500')

  // A custom value is validated against the supported range before it is kept.
  await retention.click()
  await page.getByRole('option', { name: 'Custom…' }).click()
  const custom = row.getByRole('spinbutton', { name: /Diagnostics retention/ })
  await custom.fill('10')
  await custom.press('Enter')
  await expect(custom).toHaveAttribute('aria-invalid', 'true')
  await expect(custom).toHaveAccessibleDescription(/Enter a whole number from 50 to 20000/)

  await custom.fill('750')
  await custom.press('Enter')
  await expect(custom).toHaveAttribute('aria-invalid', 'false')

  await reloadAndOpenDiagnostics(page)
  await expect(retention).toHaveText('Custom…')
  await expect(row.getByRole('spinbutton', { name: /Diagnostics retention/ })).toHaveValue('750')

  // Presets remain one click and persist without revealing the field.
  await retention.click()
  await page.getByRole('option', { name: '1000', exact: true }).click()
  await expect(retention).toHaveText('1000')
  await reloadAndOpenDiagnostics(page)
  await expect(retention).toHaveText('1000')
  await expect(row.getByRole('spinbutton')).toHaveCount(0)
})
