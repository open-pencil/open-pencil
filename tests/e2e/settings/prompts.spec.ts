import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openTitlePrompt(page: Page) {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByRole('tab', { name: 'Prompts', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'Chat titles', exact: true })
  await editor.focus()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  return editor
}

test('a template completes the variables its prompt offers, and filters after a pipe', async ({
  page
}) => {
  await openTitlePrompt(page)
  const options = page.getByRole('listbox').getByRole('option')

  await page.keyboard.type('{{ re')
  await expect(options).toHaveCount(2)
  await expect(options.first()).toContainText('reply')
  await expect(options.last()).toContainText('request')
  // The list opens inside the Settings dialog without pushing its content out of view.
  await expect(page.getByRole('heading', { name: 'Chat titles', exact: true })).toBeInViewport()

  await page.keyboard.type('quest | uppe')
  await expect(options).toHaveCount(1)
  await expect(options.first()).toContainText('upper')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Chat titles', exact: true })).toContainText(
    '{{ request | upper}}'
  )
})

test('a prompt lists what its variables hold, and a click writes one in', async ({ page }) => {
  const editor = await openTitlePrompt(page)
  const section = page.getByRole('region', { name: 'Chat titles', exact: true })

  await section.getByRole('button', { name: 'Variables', exact: true }).click()
  const request = section.getByRole('button', { name: /^request/ })
  await expect(request).toBeVisible()
  await request.click()

  await expect(editor).toBeFocused()
  await expect(editor).toContainText(/\{\{ request \}\}\s*$/)
})
