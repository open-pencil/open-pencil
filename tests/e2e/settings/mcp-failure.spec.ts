import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('MCP startup failures are explained and translated instead of one generic message', async ({
  page
}) => {
  // The health probe is the first thing to fail when the server cannot serve the app.
  await page.route('**/health', (route) => route.abort())
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()
  await page.getByTestId('settings-mcp-restart').click()

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
