import { expect, test, type Page } from '@playwright/test'
import { strToU8, zipSync } from 'fflate'

import { CanvasHelper } from '#tests/helpers/canvas'

const SKILL =
  '---\nname: grid\ndescription: Lay out pages on an eight-point grid.\n---\n# Grid\n\nSnap every frame to multiples of 8.'

async function openSkills(page: Page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByRole('tab', { name: 'Skills', exact: true }).click()
}

async function upload(page: Page, name: string, buffer: Buffer) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload skill' }).click()
  await (await chooser).setFiles({ name, mimeType: 'application/octet-stream', buffer })
}

test('an uploaded skill is switched in the list, read in its details, and deleted', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await openSkills(page)

  await upload(page, 'grid.zip', Buffer.from(zipSync({ 'grid/SKILL.md': strToU8(SKILL) })))
  const panel = page.getByTestId('settings-skills-panel')
  const toggle = panel.getByRole('switch', { name: 'grid', exact: true })
  await expect(toggle).toHaveAttribute('data-state', 'checked')
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-state', 'unchecked')

  await page.reload()
  await canvas.waitForInit()
  await openSkills(page)
  await expect(toggle).toHaveAttribute('data-state', 'unchecked')

  await panel.locator('[data-item="grid"]').getByRole('button').first().click()
  const details = page.getByTestId('settings-skill-details')
  await expect(details.getByRole('heading', { name: 'Grid', exact: true })).toBeVisible()
  await expect(page.getByTestId('settings-breadcrumb')).toContainText('grid')
  await expect(details.getByRole('switch')).toHaveAttribute('data-state', 'unchecked')

  await details.getByRole('button', { name: 'Delete skill' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete skill' }).click()
  await expect(details).toBeHidden()
  await expect(panel.locator('[data-item="grid"]')).toHaveCount(0)
})

test('a file that holds no skill is refused', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await openSkills(page)
  await upload(page, 'notes.zip', Buffer.from(zipSync({ 'README.md': strToU8('# Notes') })))
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('[data-item]')).toHaveCount(0)
})
