import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function selectMCPSection(page: Page, mobile: boolean) {
  if (mobile) {
    await page.getByRole('combobox', { name: 'Settings', exact: true }).click()
    await page.getByRole('option', { name: 'MCP', exact: true }).click()
  } else {
    await page.getByTestId('settings-section-mcp').click()
  }
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 }
]) {
  test(`MCP settings separate access controls and discard cancelled drafts at ${viewport.width}px`, async ({
    page
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
    await selectMCPSection(page, viewport.width < 640)
    await expect(page.getByRole('heading', { name: 'Local server', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Tool access', exact: true }).click()
    const search = page.getByRole('searchbox', { name: 'Search tools' })
    await search.fill('no-such-mcp-tool')
    await expect(page.getByText('No tools match your search.', { exact: true })).toBeVisible()
    await selectMCPSection(page, viewport.width < 640)
    const access = page.getByRole('combobox', { name: 'Browser agent access' })
    await expect(access).toHaveText('Off')
    await access.click()
    await page.getByRole('option', { name: 'Inspect', exact: true }).click()
    await expect(
      page.getByText('Agents can inspect the document but cannot change it.', { exact: true })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Add connection', exact: true }).click()
    await expect(page.getByText('Enable for ACP agents', { exact: true })).toBeVisible()
    await expect(page.getByText('Use bearer authentication', { exact: true })).toBeVisible()
    await page.getByRole('switch', { name: 'Use bearer authentication' }).click()
    await page.getByLabel('Bearer token', { exact: true }).fill('test-only-discarded-token')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Add connection', exact: true }).click()
    await page.getByRole('switch', { name: 'Use bearer authentication' }).click()
    await expect(page.getByLabel('Bearer token', { exact: true })).toHaveValue('')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByTestId('app-settings-done').click()
    await page.reload()
    await canvas.waitForInit()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
    await selectMCPSection(page, viewport.width < 640)
    await expect(access).toHaveText('Inspect')
  })
}

test('MCP connection forms validate, retain invalid drafts and reset dirty state', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await selectMCPSection(page, false)
  await page.getByRole('button', { name: 'Add connection', exact: true }).click()
  const name = page.getByRole('textbox', { name: 'Connection name', exact: true })
  const url = page.getByRole('textbox', { name: 'MCP server URL', exact: true })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await save.click()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(url).toHaveAttribute('aria-invalid', 'true')
  await expect(name).toHaveAccessibleDescription(/This field is required\./)
  await expect(name).toBeFocused()
  await name.fill('open-pencil')
  await url.fill('http://example.com/mcp')
  await save.click()
  await expect(url).toHaveAttribute('aria-invalid', 'true')
  await url.fill('https://example.com/mcp')
  await page.getByRole('switch', { name: 'Use bearer authentication' }).click()
  const token = page.getByLabel('Bearer token', { exact: true })
  await token.fill('test-only-unsaved-token')
  await save.click()
  await expect(name).toHaveAccessibleDescription(/Choose a unique name/)
  await expect(name).toHaveValue('open-pencil')
  await expect(token).toHaveValue('test-only-unsaved-token')
  await name.fill('Valid connection')
  await expect(name).toHaveAttribute('aria-invalid', 'false')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Add connection', exact: true }).click()
  await expect(name).toHaveValue('')
  await expect(name).toHaveAttribute('aria-invalid', 'false')
  await name.fill('Temporary')
  await page.getByTestId('settings-section-tools').click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await name.fill('')
  await page.getByTestId('settings-section-tools').click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await selectMCPSection(page, false)
  await page.getByRole('button', { name: 'Add connection', exact: true }).click()
  await name.fill('Saved connection')
  await url.fill('https://example.com/mcp')
  await save.click()
  await expect(page.getByRole('button', { name: /Saved connection/ })).toBeVisible()
})
