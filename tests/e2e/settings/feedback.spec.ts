import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openSettings(page: Page) {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
}

test('model Save and Test explain missing fields and focus the first error', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await openSettings(page)
  await page.getByTestId('settings-section-ai').click()
  await page.getByTestId('settings-add-model').click()
  const editor = page.getByTestId('settings-model-editor')
  const name = editor.getByRole('textbox', { name: 'Name', exact: true })
  const save = page.getByRole('button', { name: 'Save model', exact: true })
  await expect(editor.locator('[aria-invalid="true"]')).toHaveCount(0)
  await name.fill('')
  await name.press('Tab')
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(editor.locator('[aria-invalid="true"]')).toHaveCount(1)
  await expect(save).toBeEnabled()
  await save.click()
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(name).toHaveAccessibleDescription(/^This field is required\./)
  expect(
    await name.evaluate((control) => {
      const [errorID, hintID] = control.getAttribute('aria-describedby')?.split(' ') ?? []
      if (!errorID || !hintID) return false
      const error = document.getElementById(errorID)
      const hint = document.getElementById(hintID)
      return Boolean(
        error && hint && error.getBoundingClientRect().bottom <= hint.getBoundingClientRect().top
      )
    })
  ).toBe(true)
  await expect(name).toHaveCSS('border-top-color', 'rgb(248, 113, 113)')
  await expect(editor.getByRole('alert').first()).toHaveCSS('color', 'rgb(248, 113, 113)')
  await name.fill('My model')
  await expect(name).toHaveAttribute('aria-invalid', 'false')
  const testConnection = page.getByTestId('provider-test-connection')
  await expect(testConnection).toBeEnabled()
  await testConnection.click()
  await expect(editor.locator('[aria-invalid="true"]').first()).toBeFocused()
})

test('storage validates preferences and test credentials without saving', async ({ page }) => {
  await openSettings(page)
  await page.getByTestId('settings-section-storage').click()
  await expect(
    page.getByText('Configure the connection before opening the workspace.')
  ).toBeVisible()
  await page.getByRole('button', { name: /S3 storage/ }).click()
  const endpoint = page.getByRole('textbox', { name: 'Endpoint', exact: true })
  const bucket = page.getByRole('textbox', { name: 'Bucket', exact: true })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(endpoint).toBeFocused()
  await expect(endpoint).toHaveAttribute('aria-invalid', 'true')
  await endpoint.fill('https://example.com')
  await bucket.fill('designs')
  await expect(endpoint).toHaveAttribute('aria-invalid', 'false')
  await page.getByTestId('settings-storage-test').click()
  const key = page.getByRole('textbox', { name: 'Access key ID', exact: true })
  await expect(key).toBeFocused()
  await expect(key).toHaveAttribute('aria-invalid', 'true')
  await expect(key).toHaveAccessibleDescription('This field is required.')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(
    page.getByText('Configure the connection before opening the workspace.')
  ).toBeVisible()
})

async function failCredentialWrites(page: Page) {
  return page.evaluateHandle(async () => {
    const path = '/src/app/settings/credentials/app.ts'
    const { appCredentialServices } = await import(path)
    const original = appCredentialServices.manager.set
    appCredentialServices.manager.set = async () => {
      throw new Error('Test credential write failure')
    }
    return {
      restore() {
        appCredentialServices.manager.set = original
      }
    }
  })
}

test('media explains optional keys and preserves input after a failed save', async ({ page }) => {
  await openSettings(page)
  await page.getByTestId('settings-section-media').click()
  await page.getByRole('button', { name: /Pexels/ }).click()
  const key = page.getByRole('textbox', { name: 'API key', exact: true })
  await expect(page.getByRole('link', { name: 'Get API key' })).toHaveAttribute(
    'href',
    'https://www.pexels.com/api/'
  )
  await expect(key).toHaveAccessibleDescription('Optional. Add a key to enable this service.')
  await key.fill('test-only-replacement')
  const failure = await failCredentialWrites(page)
  try {
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(key).toHaveValue('test-only-replacement')
    await expect(key).not.toHaveAttribute('aria-invalid', 'true')
    await expect(
      page.getByRole('alert', {
        name: 'Could not save these changes. Check the settings and try again.',
        exact: true
      })
    ).toBeVisible()
    await expect(key).toHaveAccessibleDescription('Optional. Add a key to enable this service.')
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  } finally {
    await failure.evaluate((handle) => handle.restore())
    await failure.dispose()
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: /Pexels/ })).toBeVisible()
})

test('MCP requires a token only for enabled bearer connections and preserves failed saves', async ({
  page
}) => {
  await openSettings(page)
  await page.getByTestId('settings-section-mcp').click()
  await page.getByRole('button', { name: 'Add connection', exact: true }).click()
  await page.getByRole('textbox', { name: 'Connection name', exact: true }).fill('Test server')
  await page
    .getByRole('textbox', { name: 'MCP server URL', exact: true })
    .fill('https://example.com/mcp')
  await page.getByRole('switch', { name: 'Enable for ACP agents' }).click()
  await page.getByRole('switch', { name: 'Use bearer authentication' }).click()
  const key = page.getByRole('textbox', { name: 'Bearer token', exact: true })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(key).toBeFocused()
  await expect(key).toHaveAttribute('aria-invalid', 'true')
  await key.fill('test-only-replacement')
  await expect(key).toHaveAttribute('aria-invalid', 'false')
  const failure = await failCredentialWrites(page)
  try {
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      page.getByText('Could not save these changes. Check the settings and try again.', {
        exact: true
      })
    ).toBeVisible()
    await expect(key).toHaveValue('test-only-replacement')
    await expect(
      page.getByText('Some changes may already be saved. Review the settings and try again.')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  } finally {
    await failure.evaluate((handle) => handle.restore())
    await failure.dispose()
  }
})

test('a partial model save is explained and retry does not duplicate the profile', async ({
  page
}) => {
  await openSettings(page)
  await page.getByTestId('settings-section-ai').click()
  await page.getByTestId('settings-add-model').click()
  await page.getByLabel('Name', { exact: true }).fill('Partial model')
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'Google AI', exact: true }).click()
  await page.getByLabel('Model ID', { exact: true }).click()
  await page.getByRole('option').first().click()
  await page.getByTestId('provider-settings-api-key').fill('test-only-key')
  const failure = await failCredentialWrites(page)
  try {
    await page.getByRole('button', { name: 'Save model', exact: true }).click()
    await expect(
      page.getByText('Some changes may already be saved. Review the settings and try again.')
    ).toBeVisible()
    await expect(page.getByTestId('provider-settings-api-key')).toHaveValue('test-only-key')
  } finally {
    await failure.evaluate((handle) => handle.restore())
    await failure.dispose()
  }
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  await expect(page.getByRole('button', { name: /Partial model/ })).toHaveCount(1)
})

test('the sole design-capable profile cannot be deleted even with other profiles present', async ({
  page
}) => {
  await openSettings(page)
  const designId = await page.evaluate(async () => {
    const path = '/src/app/ai/models/index.ts'
    const models = await import(path)
    const design = models.resolveAIModelRole('design')
    if (!design) throw new Error('Missing Design profile')
    const draft = models.createModelProfileDraft()
    draft.name = 'Text only'
    draft.providerID = 'google'
    draft.customModelID = 'text-only'
    draft.capabilities = []
    models.saveModelProfileDraft(draft)
    return design.profile.id
  })
  await page.getByTestId('settings-section-ai').click()
  await page.locator(`[data-model-id="${designId}"]`).click()
  await expect(page.getByRole('button', { name: 'Save model', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete model', exact: true })).toHaveCount(0)
})

test('MCP field feedback is translated after switching the locale', async ({ page }) => {
  await openSettings(page)
  await page.getByTestId('settings-language').click()
  await page.getByRole('option', { name: 'Русский', exact: true }).click()
  await page.getByTestId('settings-section-mcp').click()
  await page.getByRole('button', { name: 'Добавить подключение', exact: true }).click()
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  const name = page.getByRole('textbox', { name: 'Название подключения', exact: true })
  await expect(name).toBeFocused()
  await expect(name).toHaveAccessibleDescription(/Это поле обязательно\./)
  await name.fill('Мой сервер')
  await expect(name).toHaveAttribute('aria-invalid', 'false')
  const url = page.getByRole('textbox', { name: 'URL сервера MCP', exact: true })
  await url.fill('http://example.com/mcp')
  await url.press('Tab')
  await expect(url).toHaveAccessibleDescription(/Используйте HTTPS/)
  await expect(page.getByText('This field is required.', { exact: true })).toHaveCount(0)
})
