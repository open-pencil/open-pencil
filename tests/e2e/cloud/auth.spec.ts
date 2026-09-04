import { expect, test } from '@playwright/test'

import { firstHTTPSLink, MailpitClient } from '#tests/helpers/cloud/mailpit'

const cloudURL = process.env.OPENPENCIL_CLOUD_E2E_URL
const mailpitURL = process.env.OPENPENCIL_CLOUD_E2E_MAILPIT_URL
const enabled = process.env.OPENPENCIL_CLOUD_E2E === '1'
const originalPassword = 'a secure browser test password'
const replacementPassword = 'a replacement browser test password'

test.describe('Cloud credential authentication', () => {
  test.skip(!enabled, 'Run through `bun run --filter @open-pencil/cloud test:e2e:browser`')
  test.describe.configure({ mode: 'serial' })

  test('verifies email and recovers a password through captured mail', async ({ page }) => {
    test.setTimeout(60_000)
    if (!cloudURL || !mailpitURL) throw new Error('Cloud authentication E2E fixture is unavailable')
    const mailpit = new MailpitClient(mailpitURL)
    const email = `credential-${Date.now()}@cloud-e2e.test`
    await mailpit.clearMessages()

    await page.goto(`${cloudURL}/auth/sign-up`)
    await page.getByLabel('Name').fill('Credential Test')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(originalPassword)
    await page.getByLabel('Confirm password').fill(originalPassword)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await page.goto(`${cloudURL}/app`)
    await expect(page).toHaveURL(`${cloudURL}/auth/sign-in?redirect=/app`)

    const verification = await mailpit.waitForMessage({
      recipient: email,
      subject: 'Verify your OpenPencil Cloud email'
    })
    await page.goto(firstHTTPSLink(verification))
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible()
    await page.goto(`${cloudURL}/app`)
    await expect(page).toHaveURL(`${cloudURL}/account/pending`)
    await expect(page.getByRole('main').getByRole('button', { name: 'Sign out' })).toBeVisible()

    const signOutNavigation = page.waitForURL(`${cloudURL}/`)
    await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click()
    await signOutNavigation
    await page.goto(`${cloudURL}/auth/forgot-password`)
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByText(/If an account exists/)).toBeVisible()

    const reset = await mailpit.waitForMessage({
      recipient: email,
      subject: 'Reset your OpenPencil Cloud password'
    })
    await page.goto(firstHTTPSLink(reset))
    await page.getByLabel('New password').fill(replacementPassword)
    await page.getByLabel('Confirm password').fill(replacementPassword)
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Your password has been updated.')).toBeVisible()
    await mailpit.waitForMessage({
      recipient: email,
      subject: 'Your OpenPencil Cloud password changed'
    })

    await page.goto(`${cloudURL}/auth/sign-in`)
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(originalPassword)
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await expect(page.getByRole('alert')).toContainText('Invalid email or password.')
    await page.locator('input[name="password"]').fill(replacementPassword)
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await expect(page).toHaveURL(`${cloudURL}/account/pending`)
  })
})
