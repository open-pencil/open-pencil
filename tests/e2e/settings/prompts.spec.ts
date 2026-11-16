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
  const editor = page.getByRole('textbox', { name: 'Chat titles', exact: true })
  const option = (label: string) =>
    page.getByRole('listbox').getByRole('option').filter({ hasText: label })

  await page.keyboard.type('{{ re')
  await expect(option('request')).toBeVisible()
  // The list opens inside the Settings dialog without pushing its content out of view.
  await expect(page.getByRole('heading', { name: 'Chat titles', exact: true })).toBeInViewport()
  await option('request').click()
  await expect(editor).toContainText('{{ request}}')

  await page.keyboard.type(' | uppe')
  await option('upper').click()
  await expect(editor).toContainText('{{ request | upper}}')
})

test('a prompt lists what its variables hold and the text they fill, and a click writes one in', async ({
  page
}) => {
  const editor = await openTitlePrompt(page)
  const section = page.getByRole('region', { name: 'Chat titles', exact: true })

  await section.getByRole('button', { name: 'Variables and preview', exact: true }).click()
  const request = section.getByRole('button', { name: /^request/ })
  await expect(request).toBeVisible()
  const sample = /"(.+)"$/.exec((await request.textContent())?.trim() ?? '')?.[1]
  expect(sample).toBeTruthy()
  await expect(section.getByTestId('settings-prompt-preview')).toContainText(sample ?? '')
  await request.click()

  await expect(editor).toBeFocused()
  await expect(editor).toContainText(/\{\{ request \}\}\s*$/)
})
