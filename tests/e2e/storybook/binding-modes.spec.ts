import { expect, test } from '@playwright/test'

for (const outcome of ['Cancel', 'Commit']) {
  test(`captured variable modes survive target changes: ${outcome}`, async ({ page }) => {
    await page.goto('/iframe.html?id=vue-sdk-primitives-bindablevalue--mode-editing&viewMode=story')
    const values = async () =>
      JSON.parse(await page.getByLabel('Mode values').innerText()) as Record<string, number>
    const before = await values()
    await page.getByRole('button', { name: 'Begin edit', exact: true }).click()
    await page.getByRole('button', { name: 'Set 12', exact: true }).click()
    expect(Object.values(await values()).sort((a, b) => a - b)).toEqual([12, 12, 40])
    await page.getByRole('button', { name: 'Change selection and mode' }).click()
    await page.getByRole('button', { name: 'Set 20', exact: true }).click()
    expect(Object.values(await values()).sort((a, b) => a - b)).toEqual([20, 20, 40])
    await page.getByRole('button', { name: outcome, exact: true }).click()
    if (outcome === 'Commit') await page.getByRole('button', { name: 'Undo', exact: true }).click()
    expect(await values()).toEqual(before)
  })
}
