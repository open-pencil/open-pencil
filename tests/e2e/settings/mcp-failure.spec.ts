import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openMCPPage(page: Page) {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()
}

test('MCP startup failures are explained and translated instead of one generic message', async ({
  page
}) => {
  // The health probe is the first thing to fail when the server cannot serve the app.
  await page.route('**/health', (route) => route.abort())
  await openMCPPage(page)

  // Starting the app already attempted the server; the alert carries its own
  // restart action instead of the standalone button.
  await expect(
    page.getByRole('alert', { name: 'MCP server did not respond in time' })
  ).toContainText('It did not become ready within the startup timeout.')
  await expect(
    page.getByTestId('settings-mcp-automation-panel').getByRole('alert')
  ).not.toContainText('did not become healthy')

  // The same reason renders from the catalog rather than the raw error text.
  await page.getByTestId('settings-section-general').click()
  await page.getByTestId('settings-language').click()
  await page.getByRole('option', { name: 'Русский', exact: true }).click()
  await page.getByTestId('settings-section-mcp').click()
  await expect(page.getByRole('alert', { name: 'MCP-сервер не ответил вовремя' })).toContainText(
    'Он не стал готовым за отведённое время.'
  )
})

test('technical details stay collapsed inside the alert and can be copied', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  // An unreachable health endpoint keeps the failure stable while Settings mounts.
  await page.route('**/health', (route) => route.abort())
  const alert = page.getByTestId('settings-mcp-failure')
  await openMCPPage(page)
  await expect(alert).toBeVisible()

  // Collapsed content is unmounted, so the alert announces only summary copy.
  const details = page.getByRole('button', { name: 'Details', exact: true })
  await expect(details).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('settings-mcp-failure-detail')).toHaveCount(0)

  await details.click()
  await expect(details).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('settings-mcp-failure-detail')).toBeVisible()

  await page.getByRole('button', { name: 'Copy details' }).click()
  await expect(page.getByText('Diagnostic details copied.', { exact: true })).toBeVisible()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toMatch(/code=(unreachable|timeout)/)
})
