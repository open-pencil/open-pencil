import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openSection(page: Page, name: string, phone: boolean) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  if (phone) {
    await page.getByRole('combobox', { name: 'Settings', exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
  } else await page.getByRole('tab', { name, exact: true }).click()
}

test.describe('with prior tool usage', () => {
  test.use({
    storageState: async ({ baseURL }, use) => {
      if (!baseURL) throw new Error('Browser test baseURL is required')
      await use({
        cookies: [],
        origins: [
          {
            origin: new URL(baseURL).origin,
            localStorage: [
              {
                name: 'open-pencil:tools:usage',
                value: JSON.stringify({
                  startedAt: '2026-01-01T00:00:00.000Z',
                  counts: { get_selection: 4, get_node: 2, find_nodes: 7 }
                })
              }
            ]
          }
        ]
      })
    }
  })

  test('tool usage counts persist and can be sorted with the existing filters', async ({
    page
  }) => {
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await openSection(page, 'Tool access', false)

    const read = page.locator('[data-group="read"]')
    const items = read.locator('[data-item]')
    const getSelection = read.locator('[data-item="get_selection"]')
    const sort = page.getByRole('combobox', { name: 'Sort tools' })
    await expect(getSelection).toContainText('Calls: 4')
    await sort.click()
    await page.getByRole('option', { name: 'Most used' }).click()
    await expect(items.nth(0)).toHaveAttribute('data-item', 'find_nodes')
    await expect(items.nth(1)).toHaveAttribute('data-item', 'get_selection')
    await expect(items.nth(2)).toHaveAttribute('data-item', 'get_node')

    const search = page.getByRole('searchbox', { name: 'Search tools' })
    await search.fill('get_')
    await expect(items.nth(0)).toHaveAttribute('data-item', 'get_selection')
    await page.getByRole('combobox', { name: 'Show' }).click()
    await page.getByRole('option', { name: 'Disabled', exact: true }).click()
    await expect(getSelection).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Show' }).click()
    await page.getByRole('option', { name: 'All', exact: true }).click()
    await sort.click()
    await page.getByRole('option', { name: 'Name (A–Z)' }).click()
    const names = await items.evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-item') ?? '')
    )
    expect(names.indexOf('get_node')).toBeLessThan(names.indexOf('get_selection'))

    // A reload reads the saved counters without re-seeding them.
    await page.reload()
    await canvas.waitForInit()
    await openSection(page, 'Tool access', false)
    await search.fill('get_selection')
    await expect(getSelection).toContainText('Calls: 4')
  })
})

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
    const create = page.getByRole('switch', { name: 'convert_to_components', exact: true })

    // The built-in AI starts without it; the local MCP server offers it.
    await openSection(page, 'Tool access', phone)
    await search.fill('convert_to_components')
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    await create.click()
    await page.keyboard.press('Escape')

    await openSection(page, 'MCP', phone)
    await page.getByTestId('settings-mcp-tool-access').click()
    await search.fill('convert_to_components')
    await expect(create).toHaveAttribute('data-state', 'checked')
    await create.click()
    await page.keyboard.press('Escape')

    await page.reload()
    await canvas.waitForInit()
    await openSection(page, 'Tool access', phone)
    await search.fill('convert_to_components')
    await expect(create).toHaveAttribute('data-state', 'checked')
    await page.getByRole('button', { name: 'Reset to default' }).click()
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    // Back at the defaults, there is nothing left to reset.
    await expect(page.getByRole('button', { name: 'Reset to default' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await openSection(page, 'MCP', phone)
    await page.getByTestId('settings-mcp-tool-access').click()
    await search.fill('convert_to_components')
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    await page.getByRole('button', { name: 'Reset to default' }).click()
    await expect(create).toHaveAttribute('data-state', 'checked')
    await expect(page.getByRole('button', { name: 'Reset to default' })).toHaveCount(0)
  })
}
