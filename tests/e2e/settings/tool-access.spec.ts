import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const width of [1280, 390]) {
  test(`AI and MCP tool settings remain independent across reload at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    async function open() {
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
      if (width < 640) {
        await page.getByRole('combobox', { name: 'Settings', exact: true }).click()
        await page.getByRole('option', { name: 'Tool access', exact: true }).click()
      } else await page.getByRole('tab', { name: 'Tool access', exact: true }).click()
    }
    await open()
    const search = page.getByRole('searchbox', { name: 'Search tools' })
    const create = page.getByRole('switch', { name: 'create_component', exact: true })
    await search.fill('create_component')
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    await create.click()
    await page.getByRole('button', { name: 'Local MCP', exact: true }).click()
    await expect(search).toHaveValue('create_component')
    await expect(create).toHaveAttribute('data-state', 'checked')
    await create.click()
    await page.getByRole('button', { name: 'Built-in AI', exact: true }).click()
    await expect(create).toHaveAttribute('data-state', 'checked')
    await page.reload()
    await canvas.waitForInit()
    await open()
    await search.fill('create_component')
    await expect(create).toHaveAttribute('data-state', 'checked')
    await page.getByRole('button', { name: 'Restore defaults' }).click()
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    await page.getByRole('button', { name: 'Local MCP', exact: true }).click()
    await expect(create).toHaveAttribute('data-state', 'unchecked')
    await page.getByRole('button', { name: 'Restore defaults' }).click()
    await expect(create).toHaveAttribute('data-state', 'checked')
  })
}
