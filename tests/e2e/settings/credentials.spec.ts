import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('storage settings keep secrets behind the credential manager', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  const connection = page.getByRole('button', { name: /S3 storage/ })
  await connection.click()
  await page.getByLabel('Endpoint', { exact: true }).fill('https://s3.example.com')
  await page.getByLabel('Bucket', { exact: true }).fill('designs')
  await expect(page.getByRole('button', { name: 'Copy CORS JSON' })).toBeHidden()
  const secret = page.getByLabel('Secret access key', { exact: true })
  await secret.fill('storage-secret')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await save.click()
  await connection.click()
  await expect(secret).toHaveValue('')
  await expect(secret).toHaveAttribute('placeholder', /Key saved/)
  expect(
    await page.evaluate(() => {
      // oxlint-disable-next-line open-pencil/no-direct-storage-access -- Inspect persisted bytes to detect plaintext credential leaks.
      return Object.values(localStorage).some((value) => value.includes('storage-secret'))
    })
  ).toBe(false)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await connection.click()
  await expect(secret).toHaveAttribute('placeholder', /Key saved/)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await save.click()
  await page.getByTestId('app-settings-done').click()
  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  await connection.click()
  await expect(page.getByLabel('Endpoint', { exact: true })).toHaveValue('https://s3.example.com')
  await expect(secret).not.toHaveAttribute('placeholder', /Key saved/)
})

test('MCP connections keep bearer tokens out of ordinary settings', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()
  const section = page.getByTestId('app-settings-dialog')
  await section.getByRole('button', { name: 'Add connection' }).click()
  await section.getByLabel('Connection name').fill('GitHub')
  await section.getByLabel('MCP server URL').fill('http://example.com/mcp')
  await section.getByRole('button', { name: 'Save' }).click()
  await expect(section.getByLabel('MCP server URL')).toHaveAttribute('aria-invalid', 'true')

  await section.getByLabel('MCP server URL').fill('https://example.com/mcp')
  await section.getByRole('switch', { name: 'Enable for ACP agents' }).click()
  await section.getByRole('switch', { name: 'Use bearer authentication' }).click()
  await section.getByLabel('Bearer token').fill('secret-mcp-token')
  await section.getByRole('button', { name: 'Save' }).click()

  await expect(section).toContainText('GitHub')
  await expect(section).toContainText('Enabled')
  await expect(section).not.toContainText('secret-mcp-token')

  await page.getByTestId('app-settings-done').click()
  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()
  await expect(section).toContainText('https://example.com/mcp')
  await expect(section).toContainText('Enabled')
  await section.getByRole('button', { name: /GitHub/ }).click()
  await expect(section.getByPlaceholder(/Key saved/)).toBeVisible()
  await section.getByRole('button', { name: 'Clear', exact: true }).click()
  await section.getByRole('button', { name: 'Cancel', exact: true }).click()
  await section.getByRole('button', { name: /GitHub/ }).click()
  await expect(section.getByPlaceholder(/Key saved/)).toBeVisible()
  await section.getByRole('button', { name: 'Clear', exact: true }).click()
  await section.getByRole('button', { name: 'Save', exact: true }).click()
  await section.getByRole('button', { name: /GitHub/ }).click()
  await expect(section.getByPlaceholder(/Key saved/)).toHaveCount(0)
  await section.getByRole('button', { name: 'Delete connection' }).click()
  const confirmation = page.getByRole('alertdialog')
  await expect(confirmation).toContainText('remove its saved bearer token')
  await confirmation.getByRole('button', { name: 'Delete connection' }).click()
  await expect(section).toContainText('No external MCP connections configured')
})

test('MCP automation settings filter and persist tool availability', async ({ page }) => {
  await page.route('**/health', (route) =>
    route.fulfill({
      json: {
        status: 'ok',
        tools: [
          {
            name: 'create_shape',
            description: 'Create a shape',
            effect: 'write',
            availability: 'default',
            capabilities: ['document:write'],
            enabled: true
          },
          {
            name: 'get_page_tree',
            description: 'Inspect the page',
            effect: 'read',
            availability: 'default',
            capabilities: ['document:read'],
            enabled: true
          }
        ]
      }
    })
  )
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()

  const authentication = page.getByTestId('settings-mcp-authentication')
  await expect(authentication).toHaveAttribute('data-state', 'checked')
  await authentication.click()
  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()
  await expect(authentication).toHaveAttribute('data-state', 'unchecked')
  await authentication.click()

  await page.getByRole('button', { name: 'Tool access', exact: true }).click()
  const search = page.getByRole('searchbox', { name: 'Search tools' })
  await search.fill('create_shape')
  await expect(search).toHaveValue('create_shape')
  const createShape = page.getByRole('switch', { name: 'create_shape', exact: true })
  await expect(createShape).toBeVisible()
  await expect(page.getByRole('switch', { name: 'get_page_tree', exact: true })).toBeHidden()

  await createShape.click()
  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()
  await page.getByRole('button', { name: 'Tool access', exact: true }).click()
  await expect(createShape).toHaveAttribute('data-state', 'unchecked')

  await page.getByRole('button', { name: 'Restore defaults' }).click()
  await expect(createShape).toHaveAttribute('data-state', 'checked')
})

test('model library keeps reusable profiles and role assignments', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
  await page.getByTestId('settings-add-model').click()
  await page.getByLabel('Name').fill('Fast model')
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'Google AI' }).click()
  await page.getByLabel('Model ID').click()
  await page.getByRole('option').first().click()
  await page.getByRole('button', { name: 'Save model' }).click()

  await page.getByTestId('settings-add-model').click()
  await page.getByLabel('Name').fill('Vision model')
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter' }).click()
  await page.getByLabel('Model ID').first().click()
  await page.getByRole('option').first().click()
  await page.getByRole('button', { name: 'Save model' }).click()

  await page.getByTestId('settings-model-assignment-fast').click()
  await page.getByRole('option', { name: 'Fast model' }).click()
  await page.getByTestId('settings-model-assignment-vision').click()
  await page.getByRole('option', { name: 'Vision model' }).click()
  await page.getByTestId('app-settings-done').click()

  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
  await expect(page.getByTestId('settings-model-list')).toContainText('Fast model')
  await expect(page.getByTestId('settings-model-list')).toContainText('Vision model')
  await expect(page.getByTestId('settings-model-assignment-fast')).toContainText('Fast model')
  await expect(page.getByTestId('settings-model-assignment-vision')).toContainText('Vision model')
})

test('remembered browser credentials survive reload and clear centrally', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByRole('tab', { name: 'AI' }).click()
  await page.getByTestId('provider-setup-open-settings').click()

  await page.getByTestId('settings-section-general').click()
  const remember = page.getByRole('switch', { name: 'Remember API keys on this device' })
  await expect(remember).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('settings-section-ai').click()

  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter' }).click()
  await page.getByLabel('Name').fill('Claude Sonnet')
  await page.getByTestId('provider-settings-api-key').fill('sk-or-remembered-test-key')
  await page.getByRole('button', { name: 'Save model' }).click()
  await page.getByTestId('app-settings-done').click()
  await expect(page.getByTestId('chat-input')).toBeVisible()

  await page.reload()
  await canvas.waitForInit()
  await page.getByRole('tab', { name: 'AI' }).click()
  await expect(page.getByTestId('chat-input')).toBeVisible()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('provider-settings-clear-key').click()
  await page
    .getByTestId('settings-model-editor')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await page.getByTestId('settings-section-general').click()
  await remember.click()
  await page.getByTestId('app-settings-done').click()

  await page.reload()
  await canvas.waitForInit()
  await page.getByRole('tab', { name: 'AI' }).click()
  await expect(page.getByTestId('provider-setup-open-settings')).toBeVisible()
})

test('browser credential preferences live in General, not the footer', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('ControlOrMeta+,')
  const panel = page.getByTestId('settings-general-panel')
  const remember = panel.getByRole('switch', { name: 'Remember API keys on this device' })
  await expect(remember).toBeVisible()
  if ((await remember.getAttribute('aria-checked')) === 'true') await remember.click()
  await expect(remember).toHaveAttribute('aria-checked', 'false')
  await expect(panel.getByText('Keys are kept only until you close this session.')).toBeVisible()
  await remember.click()
  await expect(remember).toHaveAttribute('aria-checked', 'true')
  await expect(panel.getByText('Keys are kept only until you close this session.')).toBeHidden()
  await expect(page.getByText('system credential store', { exact: false })).toHaveCount(0)
  await page.getByTestId('app-settings-done').click()
})
