import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openSettings(page: Page) {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`Settings disclosures open, close and reopen with ${reducedMotion} motion`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.emulateMedia({ reducedMotion })
    await openSettings(page)
    await expect(page.getByRole('dialog')).toHaveCSS('width', '840px')
    await page.getByTestId('settings-section-tools').click()
    const trigger = page.getByRole('button', { name: 'Read-only tools', exact: true })
    await trigger.click()
    await expect(page.getByRole('switch', { name: 'get_selection', exact: true })).toBeHidden()
    const motion = await trigger.evaluate(async (button) => {
      if (!(button instanceof HTMLButtonElement)) throw new Error('Expected a disclosure button')
      button.click()
      await new Promise(requestAnimationFrame)
      const id = button.getAttribute('aria-controls')
      if (!id) throw new Error('Missing disclosure relationship')
      const content = document.getElementById(id)
      if (!content) throw new Error('Missing disclosure content')
      const opening = getComputedStyle(content).animationName
      await Promise.allSettled(content.getAnimations().map((animation) => animation.finished))
      const expanded = content.getBoundingClientRect().height
      button.click()
      await Promise.resolve()
      const closing = getComputedStyle(content).animationName
      button.click()
      await Promise.resolve()
      await Promise.allSettled(content.getAnimations().map((animation) => animation.finished))
      return { opening, closing, expanded }
    })
    expect(motion.opening).toBe(reducedMotion === 'reduce' ? 'none' : 'collapsible-down')
    expect(motion.closing).toBe(reducedMotion === 'reduce' ? 'none' : 'collapsible-up')
    expect(motion.expanded).toBeGreaterThan(0)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('switch', { name: 'get_selection', exact: true })).toBeVisible()
    await trigger.click()
    await expect(page.getByRole('switch', { name: 'get_selection', exact: true })).toBeHidden()
    await expect(page.getByTestId('app-settings-done')).toBeVisible()
  })
}

test('external Settings requests respect a dirty editor', async ({ page }) => {
  await openSettings(page)
  await page.getByTestId('settings-section-ai').click()
  await page.getByTestId('settings-add-model').click()
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  await name.fill('Keep this draft')
  const requestSection = () =>
    page.evaluate(async () => {
      const path = '/src/app/settings/dialog.ts'
      const { openSettingsDialog } = await import(path)
      openSettingsDialog('media')
    })
  await requestSection()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(name).toHaveValue('Keep this draft')
  await requestSection()
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByRole('button', { name: /Pexels/ })).toBeVisible()
})

test('model credential Clear is staged until Save and Cancel preserves the saved key', async ({
  page
}) => {
  await openSettings(page)
  const credential = await page.evaluateHandle(async () => {
    const path = '/src/app/ai/models/index.ts'
    const models = await import(path)
    const draft = models.createModelProfileDraft()
    draft.name = 'Credential retention test'
    draft.providerID = 'openai'
    draft.customModelID = 'test-only-model'
    const profile = models.saveModelProfileDraft(draft)
    await models.setModelConnectionAPIKey(profile.connectionId, 'test-only-secret')
    return { status: () => models.modelConnectionCredentialStatus(profile.connectionId) }
  })
  try {
    await page.getByTestId('settings-section-ai').click()
    const row = page.getByRole('button', { name: /Credential retention test/ })
    await row.click()
    const clear = page.getByTestId('provider-settings-clear-key')
    await expect(clear).toBeVisible()
    await clear.click()
    expect(await credential.evaluate((saved) => saved.status())).toBe('configured')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await row.click()
    await expect(clear).toBeVisible()
    await clear.click()
    await page.getByRole('button', { name: 'Save model', exact: true }).click()
    await expect(row).toBeVisible()
    expect(await credential.evaluate((saved) => saved.status())).toBe('missing')
  } finally {
    await credential.dispose()
  }
})
