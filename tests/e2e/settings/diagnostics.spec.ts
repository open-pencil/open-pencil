import type { Page } from '@playwright/test'
import * as v from 'valibot'

import { CanvasHelper } from '#tests/helpers/canvas'
import { expect, test } from '#tests/helpers/chat/fixture'

/** The JSON that Copy diagnostics puts on the clipboard, as far as these tests read it. */
const ReportJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    environment: v.object({ app: v.string(), shell: v.string() }),
    events: v.array(
      v.object({
        name: v.string(),
        sessionId: v.optional(v.string()),
        runId: v.optional(v.string()),
        attributes: v.record(v.string(), v.unknown())
      })
    )
  })
)

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
  const { environment, events } = v.parse(ReportJSON, text)
  expect(environment).toMatchObject({ app: expect.any(String), shell: 'browser' })
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

test('uncaught errors are listed with their stack and can be filtered and copied', async ({
  configuredChat: chat,
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await chat.submit('A request that records info events')
  await expect(chat.assistantMessage()).toBeVisible()
  await page.evaluate(() => {
    setTimeout(() => {
      throw new TypeError('Attempting to define property on object that is not extensible.')
    })
  })
  await openDiagnostics(page)

  const events = page.locator('[data-slot="diagnostics-events"]')
  const failure = events.getByRole('button', { name: /Error: TypeError/ })
  await expect(failure).toContainText(
    'Attempting to define property on object that is not extensible.'
  )
  await failure.click()
  await expect(events.locator('pre')).toContainText('TypeError')
  // Events recorded before Settings opened are counted.
  await expect(page.getByText(/^[1-9]\d* events · /)).toBeVisible()

  // Info events such as the completed chat drop out when only problems are shown.
  await expect(events.getByRole('button', { name: /AI chat completed/ })).toBeVisible()
  await events.getByRole('button', { name: 'Errors and warnings' }).click()
  await expect(events.getByRole('button', { name: /AI chat completed/ })).toHaveCount(0)
  await expect(failure).toBeVisible()

  await page.getByRole('button', { name: 'Copy diagnostics', exact: true }).click()
  // The clipboard outlives the test's page, so read it only once this copy has finished.
  await expect(page.getByText('Diagnostics copied to clipboard.', { exact: true })).toBeVisible()
  const report = v.parse(ReportJSON, await page.evaluate(() => navigator.clipboard.readText()))
  const runtime = report.events.find((event) => event.name === 'runtime.error')
  expect(runtime?.attributes).toMatchObject({ source: 'window', errorName: 'TypeError' })
  expect(String(runtime?.attributes.stack)).toContain('TypeError')
})
