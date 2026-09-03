import { expect, test } from '@playwright/test'

const enabled = process.env.OPENPENCIL_CLOUD_E2E === '1'
const serverURL = process.env.OPENPENCIL_CLOUD_E2E_URL ?? ''

test.describe('Cloud account and administration', () => {
  test.skip(!enabled, 'Cloud browser E2E environment is unavailable')

  test('offers normal sign-up and sign-in flows', async ({ page }) => {
    const discoveryRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/.well-known/openpencil')) discoveryRequests.push(request.url())
    })
    await page.goto(`${serverURL}/sign-up`)
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    expect(discoveryRequests).toEqual([])

    await page.goto(`${serverURL}/`)
    await expect(page.getByRole('link', { name: 'Sign up' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin sign in' })).toHaveCount(0)

    await page.evaluate(() => {
      document.documentElement.dataset.navigationMarker = 'preserved'
    })
    const signUp = page.getByRole('link', { name: 'Sign up' }).first()
    await signUp.click()
    await expect(page).toHaveURL(`${serverURL}/sign-up`)
    await expect(page.locator('html')).toHaveAttribute('data-navigation-marker', 'preserved')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()

    await page.goto(`${serverURL}/join`)
    await expect(page).toHaveURL(`${serverURL}/sign-up`)
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  })

  test('shows pending account state without product access', async ({ context, page }) => {
    await context.addCookies([
      { name: 'openpencil-cloud-e2e-session', value: 'pending', url: serverURL }
    ])
    await page.goto(`${serverURL}/`)
    await expect(page).toHaveURL(`${serverURL}/account/pending`)
    await expect(
      page.getByRole('heading', { name: 'Your account is awaiting approval' })
    ).toBeVisible()
    await page.goto(`${serverURL}/app`)
    await expect(page).toHaveURL(`${serverURL}/account/pending`)
  })

  test('redirects unauthenticated admin visitors through normal sign in', async ({ page }) => {
    await page.goto(`${serverURL}/admin/enrollment`)
    await expect(page).toHaveURL(`${serverURL}/sign-in?redirect=/admin/enrollment`)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('shows Admin only to deployment administrators', async ({ context, page }) => {
    await context.addCookies([
      { name: 'openpencil-cloud-e2e-session', value: 'recipient', url: serverURL }
    ])
    await page.goto(`${serverURL}/app`)
    await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0)

    await context.clearCookies()
    await context.addCookies([
      { name: 'openpencil-cloud-e2e-session', value: 'owner', url: serverURL }
    ])
    await page.goto(`${serverURL}/app`)
    await expect(page.getByRole('link', { name: 'Administration' })).toBeVisible()
  })

  test('allows the deployment administrator to review enrollment', async ({ context, page }) => {
    await context.addCookies([
      { name: 'openpencil-cloud-e2e-session', value: 'owner', url: serverURL }
    ])
    await page.goto(`${serverURL}/admin/enrollment`)
    await expect(page.getByRole('heading', { name: 'Enrollment' })).toBeVisible()
    const row = page.getByRole('row').filter({ hasText: 'pending@cloud-e2e.test' })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Approve' }).click()
    await expect(row).toContainText('approved')
  })
})
