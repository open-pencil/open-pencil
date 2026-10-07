import { expect, test } from '@playwright/test'

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`

test('page markers name everyone and summarize the overflow', async ({ page }) => {
  await page.goto(story('app-collaboration-page-presence-markers--more-than-fit'))
  const markers = page.getByRole('img', { name: 'Ana, Orbit, Ben, Pixel, Fern' })
  await expect(markers).toBeVisible()
  await expect(markers.getByText('+2')).toBeVisible()
})

test('page markers render nothing for an empty page', async ({ page }) => {
  await page.goto(story('app-collaboration-page-presence-markers--nobody'))
  await expect(page.getByText('Checkout')).toBeVisible()
  await expect(page.getByRole('img')).toHaveCount(0)
})

test('the chat names the page its reply works on and offers to go there', async ({ page }) => {
  await page.goto(story('app-chat-run-location--on-another-page'))
  await expect(page.getByRole('status')).toHaveText(/Fern is working on “Checkout”/)
  await expect(page.getByRole('button', { name: 'Go to page' })).toBeVisible()
})
