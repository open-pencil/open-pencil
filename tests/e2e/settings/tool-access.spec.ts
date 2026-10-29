import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openSection(page: Page, name: string, phone: boolean) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  if (phone) {
    await page.getByRole('combobox', { name: 'Settings', exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
  } else await page.getByRole('tab', { name, exact: true }).click()
}

for (const width of [1280, 390]) {
  test(`the AI's tools on Tool access and MCP's on the MCP page stay independent at ${width}px`, async ({
    page
  }) => {
    const phone = width < 640
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const search = page.getByRole('searchbox', { name: 'Search tools' })
    const create = page.getByRole('switch', { name: 'create_component', exact: true })

    // The built-in AI starts without it; the local MCP server offers it.
    await openSection(page, 'Tool access', phone)
    await search.fill('create_component')
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    await create.click()
    await page.keyboard.press('Escape')

    await openSection(page, 'MCP', phone)
    await page.getByTestId('settings-mcp-tool-access').click()
    await search.fill('create_component')
    await expect(create).toHaveAttribute('data-state', 'checked')
    await create.click()
    await page.keyboard.press('Escape')

    await page.reload()
    await canvas.waitForInit()
    await openSection(page, 'Tool access', phone)
    await search.fill('create_component')
    await expect(create).toHaveAttribute('data-state', 'checked')
    await page.getByRole('button', { name: 'Restore defaults' }).click()
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    await page.keyboard.press('Escape')

    await openSection(page, 'MCP', phone)
    await page.getByTestId('settings-mcp-tool-access').click()
    await search.fill('create_component')
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    await page.getByRole('button', { name: 'Restore defaults' }).click()
    await expect(create).toHaveAttribute('data-state', 'checked')
  })
}
